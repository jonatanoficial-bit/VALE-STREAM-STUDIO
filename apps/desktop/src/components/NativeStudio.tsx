import { useEffect, useRef, useState } from 'react'
import { AppendOnlyStreamTarget, CanvasSource, MediaStreamAudioTrackSource, Output, WebMOutputFormat } from 'mediabunny'
import { drawStudioScene, type LogoCorner, type SceneAsset } from './studioScene'

const imageExtensions = /\.(png|jpe?g|webp|gif|bmp)$/i
const videoExtensions = /\.(mp4|webm|mov|m4v|ogv)$/i
const corners: Array<[LogoCorner, string]> = [
  ['top-left', 'Superior esquerdo'], ['top-right', 'Superior direito'],
  ['bottom-left', 'Inferior esquerdo'], ['bottom-right', 'Inferior direito']
]

export function NativeStudio({ hidden }: { hidden: boolean }) {
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState('')
  const [systemAudio, setSystemAudio] = useState(false)
  const [microphone, setMicrophone] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [micId, setMicId] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream>()
  const [levels, setLevels] = useState<Array<{ name: string; db: number }>>([])
  const [stream, setStream] = useState<MediaStream>()
  const [mode, setMode] = useState<'record' | 'live'>()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [showLive, setShowLive] = useState(false)
  const [recordLive, setRecordLive] = useState(false)
  const [chatId, setChatId] = useState('')
  const [assets, setAssets] = useState<SceneAsset[]>([])
  const [activeAsset, setActiveAsset] = useState<SceneAsset>()
  const [logo, setLogo] = useState<SceneAsset>()
  const [corner, setCorner] = useState<LogoCorner>('top-right')
  const [logoSize, setLogoSize] = useState(16)
  const [logoOpacity, setLogoOpacity] = useState(100)
  const [title, setTitle] = useState('')
  const [mediaVolume, setMediaVolume] = useState(80)
  const [loop, setLoop] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [mediaTime, setMediaTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const cameraVideo = useRef<HTMLVideoElement>(null)
  const program = useRef<HTMLCanvasElement>(null)
  const mediaVideo = useRef<HTMLVideoElement | null>(null)
  const mediaImage = useRef<HTMLImageElement | null>(null)
  const logoImage = useRef<HTMLImageElement | null>(null)
  const mediaGain = useRef<GainNode | null>(null)
  const useCameraOverlay = useRef(false)
  const objectUrls = useRef(new Set<string>())
  const scene = useRef({ corner, logoSize, logoOpacity, title })
  const finishOutput = useRef<(() => void) | undefined>(undefined)
  const sourceCleanup = useRef<(() => void) | undefined>(undefined)

  useEffect(() => { scene.current = { corner, logoSize, logoOpacity, title } }, [corner, logoSize, logoOpacity, title])

  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  useEffect(() => {
    if (mediaGain.current) mediaGain.current.gain.value = mediaVolume / 100
    if (mediaVideo.current) mediaVideo.current.loop = loop
  }, [stream, mediaVolume, loop])

  useEffect(() => {
    const image = logo && new Image()
    if (image) {
      image.onerror = () => setStatus('Não foi possível abrir a imagem do logotipo.')
      image.src = logo.url
    }
    logoImage.current = image || null
    return () => { if (image) image.onerror = null }
  }, [logo])

  useEffect(() => {
    const player = mediaVideo.current
    mediaImage.current = null
    setPlaying(false)
    setMediaTime(0)
    setMediaDuration(0)
    if (player) {
      player.pause()
      player.onerror = null
      player.removeAttribute('src')
      player.load()
    }
    if (activeAsset?.kind === 'image') {
      const image = new Image()
      image.onerror = () => setStatus('Não foi possível abrir a imagem selecionada.')
      image.src = activeAsset.url
      mediaImage.current = image
      return () => { image.onerror = null }
    }
    if (player && activeAsset?.kind === 'video') {
      player.onerror = () => setStatus('O vídeo não pôde ser reproduzido. Tente MP4 com H.264/AAC ou WebM com VP8/Opus.')
      player.src = activeAsset.url
      player.load()
    }
  }, [activeAsset, stream])

  function paint(context: CanvasRenderingContext2D) {
    const media = mediaImage.current ?? (mediaVideo.current?.getAttribute('src') ? mediaVideo.current : null)
    drawStudioScene(context, {
      ...scene.current, capture: video.current, camera: useCameraOverlay.current || media ? cameraVideo.current : null,
      media, logo: logoImage.current
    })
  }

  useEffect(() => {
    const context = program.current?.getContext('2d')
    if (hidden || !context) return
    const refresh = () => paint(context)
    refresh()
    const timer = window.setInterval(refresh, 40)
    return () => window.clearInterval(timer)
  }, [hidden])

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.srcObject = stream ?? null
    if (stream) void element.play().catch(() => undefined)
  }, [stream])

  useEffect(() => {
    if (cameraVideo.current) cameraVideo.current.srcObject = cameraStream ?? null
  }, [cameraStream])

  useEffect(() => {
    const refreshDevices = () => void navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => undefined)
    refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [])

  useEffect(() => () => {
    sourceCleanup.current?.()
    finishOutput.current?.()
  }, [])

  function localAsset(file: File, kind: SceneAsset['kind']): SceneAsset {
    const url = URL.createObjectURL(file)
    objectUrls.current.add(url)
    return { id: crypto.randomUUID(), name: file.name, url, kind }
  }

  function addMedia(files: FileList | null) {
    if (!files?.length) return
    const added: SceneAsset[] = []
    for (const file of Array.from(files).slice(0, Math.max(0, 24 - assets.length))) {
      if (imageExtensions.test(file.name)) added.push(localAsset(file, 'image'))
      else if (videoExtensions.test(file.name)) added.push(localAsset(file, 'video'))
    }
    if (!added.length) { setStatus('Importe uma imagem ou um vídeo compatível. A biblioteca aceita até 24 itens.'); return }
    setAssets((current) => [...current, ...added])
    if (!activeAsset) setActiveAsset(added[0])
    setStatus(`${added.length} arquivo(s) adicionado(s) à biblioteca.`)
  }

  function releaseAsset(asset: SceneAsset) {
    URL.revokeObjectURL(asset.url)
    objectUrls.current.delete(asset.url)
  }

  function removeAsset(asset: SceneAsset) {
    if (activeAsset?.id === asset.id) setActiveAsset(undefined)
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    releaseAsset(asset)
  }

  function report(error: unknown) {
    setStatus(error instanceof Error ? error.message : 'A operação não pôde ser concluída.')
  }

  async function refresh() {
    try {
      const items = await window.vale.capture.sources()
      setSources(items)
      setSelected('')
      setStatus(items.length ? 'Selecione a tela ou janela que deseja capturar.' : 'Nenhuma tela ou janela disponível.')
    } catch (error) { report(error) }
  }

  async function choose(id: string) {
    setSelected('')
    if (!id) return
    try {
      await window.vale.capture.select(id)
      setSelected(id)
    } catch (error) { report(error) }
  }

  async function preview() {
    setBusy(true)
    let display: MediaStream | undefined
    let mic: MediaStream | undefined
    let camera: MediaStream | undefined
    let audio: AudioContext | undefined
    let meterTimer: number | undefined
    try {
      if (selected) display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: systemAudio })
      if (cameraId) camera = await navigator.mediaDevices.getUserMedia({ video: cameraId === 'default' ? true : { deviceId: { exact: cameraId } } })
      if (microphone) mic = await navigator.mediaDevices.getUserMedia({ audio: micId ? { deviceId: { exact: micId } } : true })
      const primary = display ?? camera
      if (!primary && !activeAsset) throw new Error('Escolha uma tela, uma câmera ou um arquivo de mídia.')
      const result = new MediaStream(primary?.getVideoTracks() ?? [])
      const audioStreams = [{ name: 'Áudio do PC', input: display }, { name: 'Microfone', input: mic }]
        .filter(({ input }) => !!input?.getAudioTracks().length)
      {
        audio = new AudioContext()
        await audio.resume()
        const mix = audio.createMediaStreamDestination()
        const meters: Array<{ name: string; analyser: AnalyserNode; samples: Float32Array<ArrayBuffer> }> = []
        const player = document.createElement('video')
        player.preload = 'auto'
        player.playsInline = true
        player.onplay = () => setPlaying(true)
        player.onpause = player.onended = () => setPlaying(false)
        player.ontimeupdate = () => setMediaTime(player.currentTime)
        player.onloadedmetadata = () => setMediaDuration(Number.isFinite(player.duration) ? player.duration : 0)
        player.onerror = () => setStatus('O vídeo não pôde ser reproduzido. Tente MP4 com H.264/AAC ou WebM com VP8/Opus.')
        mediaVideo.current = player
        const gain = audio.createGain()
        mediaGain.current = gain
        audio.createMediaElementSource(player).connect(gain)
        gain.connect(mix)
        const mediaMeter = audio.createAnalyser()
        gain.connect(mediaMeter)
        meters.push({ name: 'Áudio do vídeo', analyser: mediaMeter, samples: new Float32Array(mediaMeter.fftSize) })
        for (const { name, input } of audioStreams) {
          const source = audio.createMediaStreamSource(input!)
          const analyser = audio.createAnalyser()
          source.connect(analyser)
          source.connect(mix)
          meters.push({ name, analyser, samples: new Float32Array(analyser.fftSize) })
        }
        const program = audio.createAnalyser()
        audio.createMediaStreamSource(mix.stream).connect(program)
        meters.push({ name: 'Saída da transmissão', analyser: program, samples: new Float32Array(program.fftSize) })
        meterTimer = window.setInterval(() => setLevels(meters.map(({ name, analyser, samples }) => {
          analyser.getFloatTimeDomainData(samples)
          let peak = 0
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
          return { name, db: Math.max(-60, 20 * Math.log10(peak || 0.001)) }
        })), 80)
        result.addTrack(mix.stream.getAudioTracks()[0])
      }
      sourceCleanup.current = () => {
        window.clearInterval(meterTimer)
        setLevels([])
        setCameraStream(undefined)
        const player = mediaVideo.current
        if (player) {
          player.pause()
          player.removeAttribute('src')
          player.load()
        }
        mediaVideo.current = null
        mediaGain.current = null
        for (const item of [display, mic, camera, result]) item?.getTracks().forEach((track) => track.stop())
        if (audio) void audio.close()
      }
      result.getVideoTracks()[0]?.addEventListener('ended', () => {
        finishOutput.current?.()
        sourceCleanup.current?.()
        sourceCleanup.current = undefined
        setStream(undefined)
      }, { once: true })
      setStream(result)
      useCameraOverlay.current = Boolean(display && camera)
      if (camera) setCameraStream(camera)
      void navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => undefined)
      setStatus(systemAudio && !display?.getAudioTracks().length ? 'Prévia ativa. O Windows não disponibilizou o áudio do sistema para essa captura.' : 'Prévia ativa.')
    } catch (error) {
      setSelected('')
      display?.getTracks().forEach((track) => track.stop())
      mic?.getTracks().forEach((track) => track.stop())
      camera?.getTracks().forEach((track) => track.stop())
      window.clearInterval(meterTimer)
      if (audio) void audio.close()
      report(error)
    } finally { setBusy(false) }
  }

  async function start(next: 'record' | 'live') {
    if (!stream) {
      setStatus('Inicie a prévia antes de gravar ou transmitir.')
      return
    }
    setBusy(true)
    let opened = false
    let output: Output | undefined
    try {
      const saveLocal = next === 'record' || recordLive
      opened = await window.vale.capture.start(next === 'record' ? { mode: 'record' } : { mode: 'live', url, key, record: recordLive })
      if (!opened) return
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar o vídeo.')
      let bytesWritten = 0
      const media = new Output({
        format: new WebMOutputFormat({ appendOnly: true }),
        target: new AppendOnlyStreamTarget(new WritableStream<Uint8Array>({
          async write(data) {
            const result = await window.vale.capture.write(data)
            if (result.liveFailed) setStatus('Live interrompida. A gravação local continua.')
            bytesWritten += data.byteLength
          }
        }))
      })
      output = media
      const picture = new CanvasSource(canvas, { codec: 'vp8', bitrate: 3_500_000 })
      media.addVideoTrack(picture)
      const audioTrack = stream.getAudioTracks()[0]
      const audio = audioTrack && new MediaStreamAudioTrackSource(audioTrack, { codec: 'opus', bitrate: 128_000 })
      if (audio) media.addAudioTrack(audio)
      await media.start()
      const started = performance.now()
      const interval = 1000 / 25
      let pending: Promise<void> | undefined
      let stopping = false
      const finish = async (failure?: unknown) => {
        if (stopping) return
        stopping = true
        window.clearInterval(timer)
        setBusy(true)
        try {
          await pending
          if (failure) throw failure
          await media.finalize()
          const result = await window.vale.capture.stop()
          if (!bytesWritten) throw new Error('A captura não produziu quadros de vídeo.')
          setStatus(next === 'record' ? 'Gravação salva.' : saveLocal
            ? (result.liveFailed ? 'Live interrompida. Gravação salva.' : 'Envio encerrado. Gravação salva.')
            : 'Envio encerrado.')
        } catch (error) {
          await media.cancel().catch(() => undefined)
          await window.vale.capture.stop().catch(() => undefined)
          report(failure ?? error)
        } finally { finishOutput.current = undefined; setMode(undefined); setBusy(false) }
      }
      const draw = () => {
        if (pending || stopping) return
        pending = Promise.resolve().then(async () => {
          paint(context)
          await picture.add((performance.now() - started) / 1000, interval / 1000)
        }).finally(() => { pending = undefined })
        void pending.catch((error) => void finish(error))
      }
      const timer = window.setInterval(draw, interval)
      if (audio) void audio.errorPromise.catch((error) => void finish(error))
      finishOutput.current = () => void finish()
      draw()
      setMode(next)
      if (next === 'live') setKey('')
      setStatus(next === 'record' ? 'Gravação em andamento.' : saveLocal
        ? 'Envio iniciado. Gravando uma cópia local.' : 'Envio iniciado. Confira a recepção no painel da plataforma.')
    } catch (error) {
      await output?.cancel().catch(() => undefined)
      if (opened) await window.vale.capture.stop().catch(() => undefined)
      report(error)
    } finally { setBusy(false) }
  }

  return <section hidden={hidden} className="panel native-studio" aria-label="Produção independente">
    <h2>Produção independente</h2>
    <p>Capture uma tela, uma janela ou o apresentador do VALE. Use a reunião para compartilhar com convidados pelo navegador.</p>
    <div className="production-actions">
      <button className="button secondary" disabled={!!stream || busy} onClick={() => void refresh()}>Listar telas e janelas</button>
      <select aria-label="Tela ou janela" value={selected} disabled={!!stream || busy} onChange={(event) => void choose(event.target.value)}>
        <option value="">Escolha uma fonte</option>
        {sources.map((item, index) => <option key={item.id} value={item.id}>{item.id.startsWith('screen:') ? `Tela inteira · ${item.name || index + 1}` : item.name}</option>)}
      </select>
      <label><input type="checkbox" checked={systemAudio} disabled={!!stream || busy} onChange={(event) => setSystemAudio(event.target.checked)} /> Áudio do PC</label>
      <label><input type="checkbox" checked={microphone} disabled={!!stream || busy} onChange={(event) => setMicrophone(event.target.checked)} /> Microfone</label>
      <label>Entrada de áudio <select aria-label="Entrada de áudio" value={micId} disabled={!microphone || !!stream || busy} onChange={(event) => setMicId(event.target.value)}>
        <option value="">Padrão do Windows</option>
        {devices.filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default').map((device, index) =>
          <option key={device.deviceId} value={device.deviceId}>{device.label || `Entrada ${index + 1}`}</option>)}
      </select></label>
      <label>Câmera <select aria-label="Câmera" value={cameraId} disabled={!!stream || busy} onChange={(event) => setCameraId(event.target.value)}>
        <option value="">Desativada</option><option value="default">Padrão do Windows</option>
        {devices.filter((device) => device.kind === 'videoinput' && device.deviceId && device.deviceId !== 'default').map((device, index) =>
          <option key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${index + 1}`}</option>)}
      </select></label>
      <button className="button primary" disabled={(!selected && !cameraId && !activeAsset) || !!stream || busy} onClick={() => void preview()}>Iniciar prévia</button>
    </div>
    <video ref={video} className="studio-input-video" aria-hidden="true" autoPlay muted playsInline />
    <video ref={cameraVideo} className="studio-input-video" aria-hidden="true" autoPlay muted playsInline />
    <canvas ref={program} className="studio-program" width={1280} height={720} aria-label="Prévia da captura" />
    <div className="studio-media-panel">
      <fieldset>
        <legend>Biblioteca de mídia</legend>
        <label>Adicionar vídeos e imagens
          <input type="file" multiple accept=".mp4,.webm,.mov,.m4v,.ogv,.png,.jpg,.jpeg,.webp,.gif,.bmp"
            onChange={(event) => { addMedia(event.currentTarget.files); event.currentTarget.value = '' }} />
        </label>
        <div className="production-actions">
          <select aria-label="Mídia no ar" value={activeAsset?.id ?? ''} onChange={(event) => setActiveAsset(assets.find((item) => item.id === event.target.value))}>
            <option value="">Tela ou câmera</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          <button className="button secondary" disabled={!activeAsset} onClick={() => activeAsset && removeAsset(activeAsset)}>Remover mídia selecionada</button>
        </div>
        {activeAsset?.kind === 'video' && <>
          <div className="production-actions">
            <button className="button primary" disabled={!stream || !mediaDuration} onClick={() => {
              const player = mediaVideo.current
              if (!player) return
              if (player.paused) void player.play().catch(report)
              else player.pause()
            }}>{playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}</button>
            <button className="button secondary" disabled={!stream || !mediaDuration} onClick={() => {
              const player = mediaVideo.current
              if (player) { player.pause(); player.currentTime = 0 }
            }}>Voltar ao início</button>
            <label><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Repetir</label>
          </div>
          <label>Posição do vídeo
            <input type="range" min="0" max={mediaDuration || 1} step="0.1" value={Math.min(mediaTime, mediaDuration)} disabled={!mediaDuration}
              onChange={(event) => { if (mediaVideo.current) mediaVideo.current.currentTime = Number(event.target.value) }} />
          </label>
          <label>Volume do vídeo · {mediaVolume}%
            <input type="range" min="0" max="100" value={mediaVolume} onChange={(event) => setMediaVolume(Number(event.target.value))} />
          </label>
          {!stream && <small>Inicie a prévia para carregar os controles do vídeo.</small>}
        </>}
      </fieldset>
      <fieldset>
        <legend>Marca e identificação</legend>
        <label>Adicionar logotipo
          <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file || !imageExtensions.test(file.name)) return
            if (logo) releaseAsset(logo)
            setLogo(localAsset(file, 'image'))
          }} />
        </label>
        {logo && <>
          <div className="production-actions">
            <select aria-label="Posição do logotipo" value={corner} onChange={(event) => setCorner(event.target.value as LogoCorner)}>
              {corners.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className="button secondary" onClick={() => { releaseAsset(logo); setLogo(undefined) }}>Remover logotipo</button>
          </div>
          <label>Tamanho do logotipo · {logoSize}%
            <input type="range" min="6" max="35" value={logoSize} onChange={(event) => setLogoSize(Number(event.target.value))} />
          </label>
          <label>Opacidade do logotipo · {logoOpacity}%
            <input type="range" min="10" max="100" value={logoOpacity} onChange={(event) => setLogoOpacity(Number(event.target.value))} />
          </label>
        </>}
        <label>Faixa de identificação
          <input type="text" maxLength={100} placeholder="Nome, evento ou título" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
      </fieldset>
    </div>
    {levels.map(({ name, db }) => <div className="audio-level" key={name}>
      <span>{name}</span><meter aria-label={name} min={-60} max={0} low={-42} high={-6} optimum={-18} value={Math.min(0, db)} />
      <span>{db <= -60 ? '−∞' : db.toFixed(1)} dBFS</span>
    </div>)}
    <div className="production-actions">
      <button className="button record" disabled={!stream || !!mode || busy} onClick={() => void start('record')}>Gravar WebM</button>
      <button className="button secondary" onClick={() => setShowLive(!showLive)}>Live direta</button>
      {mode && <button className="button danger" disabled={busy} onClick={() => finishOutput.current?.()}>Finalizar {mode === 'record' ? 'gravação' : 'live'}</button>}
      <button className="button secondary" disabled={!stream || !!mode || busy} onClick={() => { sourceCleanup.current?.(); sourceCleanup.current = undefined; setStream(undefined); setSelected(''); setStatus('Captura encerrada.') }}>Encerrar prévia</button>
    </div>
    {showLive && <form className="native-live" onSubmit={(event) => { event.preventDefault(); void start('live') }}>
      <p>Informe o endereço e a chave fornecidos pelo destino da live.</p>
      <input aria-label="Servidor RTMP" placeholder="rtmps://servidor/app" required value={url} onChange={(event) => setUrl(event.target.value)} />
      <input aria-label="Chave da live direta" placeholder="Chave da live" type="password" autoComplete="off" required value={key} onChange={(event) => setKey(event.target.value)} />
      <label><input type="checkbox" checked={recordLive} disabled={!!mode || busy} onChange={(event) => setRecordLive(event.target.checked)} /> Gravar também no PC</label>
      <button className="button primary" disabled={!stream || !!mode || busy}>{recordLive ? 'Transmitir e gravar' : 'Iniciar envio direto'}</button>
    </form>}
    {showLive && <div className="production-actions">
      <button className="button secondary" onClick={() => void window.vale.app.openExternal('https://studio.youtube.com/').catch(report)}>Entrar no YouTube Studio</button>
      <input aria-label="ID da live no YouTube" placeholder="ID do vídeo da live" value={chatId} onChange={(event) => setChatId(event.target.value)} />
      <button className="button secondary" disabled={!/^[A-Za-z0-9_-]{11}$/.test(chatId.trim())} onClick={() => void window.vale.app.openExternal(`https://www.youtube.com/live_chat?is_popout=1&v=${chatId.trim()}`).catch(report)}>Abrir chat da live</button>
    </div>}
    <p role="status">{status}</p>
  </section>
}
