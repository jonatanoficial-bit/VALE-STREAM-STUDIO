import OBSWebSocket from 'obs-websocket-js'
import type { Destination, ObsSnapshot } from '../../shared/contracts'
import { assertObsEndpoint, assertRtmpUrl, safeError } from './validators'

type ObsEvent = { outputActive?: boolean; outputPath?: string; outputTimecode?: string; outputDuration?: number; outputBytes?: number }

const emptySnapshot = (): ObsSnapshot => ({
  connection: { connected: false, host: '127.0.0.1', port: 4455 },
  scenes: [],
  inputs: [],
  inputKinds: [],
  recording: { active: false },
  streaming: { active: false }
})

export class ObsBridge {
  private client = new OBSWebSocket()
  private state = emptySnapshot()
  private readonly listeners = new Set<(state: ObsSnapshot) => void>()

  constructor() {
    this.client.on('ConnectionClosed', () => {
      this.state.connection = { ...this.state.connection, connected: false, error: 'Conexão com o OBS encerrada.' }
      this.emit()
    })
    this.client.on('RecordStateChanged', (event: ObsEvent) => {
      this.state.recording = { active: Boolean(event.outputActive), outputPath: event.outputPath, timecode: event.outputTimecode }
      this.emit()
    })
    this.client.on('StreamStateChanged', (event: ObsEvent) => {
      this.state.streaming = { active: Boolean(event.outputActive), timecode: event.outputTimecode }
      this.emit()
    })
  }

  onState(listener: (state: ObsSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const value = structuredClone(this.state)
    this.listeners.forEach((listener) => listener(value))
  }

  async connect({ host, port, password }: { host: string; port: number; password: string }): Promise<ObsSnapshot> {
    assertObsEndpoint(host, port)
    this.state.connection = { connected: false, host, port }
    try {
      await this.client.connect(`ws://${host}:${port}`, password || undefined)
      const version = await this.client.call('GetVersion') as { obsVersion?: string; obsWebSocketVersion?: string }
      this.state.connection = {
        connected: true,
        host,
        port,
        obsVersion: version.obsVersion,
        websocketVersion: version.obsWebSocketVersion
      }
      return await this.refresh()
    } catch (error) {
      this.state.connection = { connected: false, host, port, error: safeError(error) }
      this.emit()
      throw new Error(`Não foi possível conectar ao OBS: ${safeError(error)}`)
    }
  }

  async disconnect(): Promise<ObsSnapshot> {
    if (this.state.connection.connected) await this.client.disconnect()
    this.state = emptySnapshot()
    this.emit()
    return this.snapshot()
  }

  async snapshot(): Promise<ObsSnapshot> {
    return structuredClone(this.state)
  }

  private requireConnection(): void {
    if (!this.state.connection.connected) throw new Error('Conecte o OBS local antes de continuar.')
  }

  async refresh(): Promise<ObsSnapshot> {
    this.requireConnection()
    try {
      const [scenes, inputs, kinds, current, recording, streaming] = await Promise.all([
        this.client.call('GetSceneList') as Promise<{ scenes: Array<{ sceneName: string }> }>,
        this.client.call('GetInputList') as Promise<{ inputs: Array<{ inputName: string; inputKind: string; inputMuted?: boolean }> }>,
        this.client.call('GetInputKindList') as Promise<{ inputKinds: string[] }>,
        this.client.call('GetCurrentProgramScene') as Promise<{ currentProgramSceneName?: string; sceneName?: string }>,
        this.client.call('GetRecordStatus') as Promise<{ outputActive: boolean; outputPath?: string; outputTimecode?: string }>,
        this.client.call('GetStreamStatus') as Promise<{ outputActive: boolean; outputTimecode?: string }>
      ])
      this.state = {
        ...this.state,
        scenes: scenes.scenes.map((scene) => scene.sceneName),
        currentScene: current.sceneName ?? current.currentProgramSceneName,
        inputs: inputs.inputs.map((input) => ({ name: input.inputName, kind: input.inputKind, muted: input.inputMuted })),
        inputKinds: kinds.inputKinds,
        recording: { active: recording.outputActive, outputPath: recording.outputPath, timecode: recording.outputTimecode },
        streaming: { active: streaming.outputActive, timecode: streaming.outputTimecode }
      }
      this.emit()
      return this.snapshot()
    } catch (error) {
      this.state.connection.error = safeError(error)
      this.emit()
      throw new Error(`OBS respondeu com erro: ${safeError(error)}`)
    }
  }

  async switchScene(sceneName: string): Promise<ObsSnapshot> {
    this.requireConnection()
    if (!this.state.scenes.includes(sceneName)) throw new Error('A cena selecionada não existe no OBS.')
    await this.client.call('SetCurrentProgramScene', { sceneName })
    return this.refresh()
  }

  async setMute(inputName: string, inputMuted: boolean): Promise<ObsSnapshot> {
    this.requireConnection()
    if (!this.state.inputs.some((input) => input.name === inputName)) throw new Error('A fonte selecionada não existe no OBS.')
    await this.client.call('SetInputMute', { inputName, inputMuted })
    return this.refresh()
  }

  async addInput(input: { sceneName: string; inputName: string; inputKind: string; settings: Record<string, unknown> }): Promise<ObsSnapshot> {
    this.requireConnection()
    if (!this.state.scenes.includes(input.sceneName)) throw new Error('Escolha uma cena existente no OBS.')
    if (!this.state.inputKinds.includes(input.inputKind)) throw new Error('O tipo de fonte não está disponível nesta instalação do OBS.')
    if (!/^[\p{L}\p{N} _-]{1,80}$/u.test(input.inputName)) throw new Error('Informe um nome simples para a fonte.')
    await this.client.call('CreateInput', {
      sceneName: input.sceneName,
      inputName: input.inputName,
      inputKind: input.inputKind,
      inputSettings: input.settings,
      sceneItemEnabled: true
    })
    return this.refresh()
  }

  async startRecord(): Promise<ObsSnapshot> {
    this.requireConnection()
    const status = await this.client.call('GetRecordStatus') as { outputActive: boolean }
    if (!status.outputActive) await this.client.call('StartRecord')
    return this.refresh()
  }

  async stopRecord(): Promise<ObsSnapshot> {
    this.requireConnection()
    const status = await this.client.call('GetRecordStatus') as { outputActive: boolean }
    if (status.outputActive) await this.client.call('StopRecord')
    return this.refresh()
  }

  async configureDestination(destination: { platform: Destination['platform']; server: string; key: string }): Promise<Destination> {
    this.requireConnection()
    assertRtmpUrl(destination.server)
    if (destination.key.trim().length < 4) throw new Error('Informe uma chave de transmissão válida fornecida pela plataforma.')
    await this.client.call('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: destination.server.trim(), key: destination.key.trim(), use_auth: false }
    })
    return { platform: destination.platform, server: destination.server, configured: true }
  }

  async startStream(): Promise<ObsSnapshot> {
    this.requireConnection()
    const status = await this.client.call('GetStreamStatus') as { outputActive: boolean }
    if (!status.outputActive) await this.client.call('StartStream')
    return this.refresh()
  }

  async stopStream(): Promise<ObsSnapshot> {
    this.requireConnection()
    const status = await this.client.call('GetStreamStatus') as { outputActive: boolean }
    if (status.outputActive) await this.client.call('StopStream')
    return this.refresh()
  }
}
