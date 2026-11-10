import { useEffect, useRef, useState } from 'react'
import { AppendOnlyStreamTarget, CanvasSource, MediaStreamAudioTrackSource, Output, WebMOutputFormat } from 'mediabunny'

export function NativeStudio({ hidden }: { hidden: boolean }) {
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState('')
  const [systemAudio, setSystemAudio] = useState(false)
  const [microphone, setMicrophone] = useState(false)
  const [stream, setStream] = useState<MediaStream>()
  const [mode, setMode] = useState<'record' | 'live'>()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [showLive, setShowLive] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const finishOutput = useRef<(() => void) | undefined>(undefined)
  const sourceCleanup = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.srcObject = stream ?? null
    if (stream) void element.play().catch(() => undefined)
  }, [stream])

  useEffect(() => () => {
    sourceCleanup.current?.()
    finishOutput.current?.()
  }, [])

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
    let audio: AudioContext | undefined
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: systemAudio })
      if (microphone) mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      const result = new MediaStream(display.getVideoTracks())
      const audioStreams = [display, mic].filter((item): item is MediaStream => !!item?.getAudioTracks().length)
      if (audioStreams.length === 1) result.addTrack(audioStreams[0].getAudioTracks()[0])
      if (audioStreams.length > 1) {
        audio = new AudioContext()
        await audio.resume()
        const mix = audio.createMediaStreamDestination()
        for (const item of audioStreams) audio.createMediaStreamSource(item).connect(mix)
        result.addTrack(mix.stream.getAudioTracks()[0])
      }
      sourceCleanup.current = () => {
        for (const item of [display, mic, result]) item?.getTracks().forEach((track) => track.stop())
        if (audio) void audio.close()
      }
      result.getVideoTracks()[0].addEventListener('ended', () => {
        finishOutput.current?.()
        sourceCleanup.current?.()
        sourceCleanup.current = undefined
        setStream(undefined)
      }, { once: true })
      setStream(result)
      setStatus(systemAudio && !display.getAudioTracks().length ? 'Prévia ativa. O Windows não disponibilizou o áudio do sistema para essa captura.' : 'Prévia ativa.')
    } catch (error) {
      setSelected('')
      display?.getTracks().forEach((track) => track.stop())
      mic?.getTracks().forEach((track) => track.stop())
      if (audio) void audio.close()
      report(error)
    } finally { setBusy(false) }
  }

  async function start(next: 'record' | 'live') {
    const previewVideo = video.current
    if (!stream?.getVideoTracks().some((track) => track.readyState === 'live') || !previewVideo?.videoWidth ||
        previewVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setStatus('Aguarde a imagem da prévia antes de iniciar a saída.')
      return
    }
    setBusy(true)
    let opened = false
    let output: Output | undefined
    try {
      opened = await window.vale.capture.start(next === 'record' ? { mode: 'record' } : { mode: 'live', url, key })
      if (!opened) return
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1280 / previewVideo.videoWidth, 720 / previewVideo.videoHeight)
      canvas.width = Math.max(2, Math.floor(previewVideo.videoWidth * scale / 2) * 2)
      canvas.height = Math.max(2, Math.floor(previewVideo.videoHeight * scale / 2) * 2)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível preparar o vídeo.')
      let bytesWritten = 0
      const media = new Output({
        format: new WebMOutputFormat({ appendOnly: true }),
        target: new AppendOnlyStreamTarget(new WritableStream<Uint8Array>({
          async write(data) {
            await window.vale.capture.write(data)
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
          await window.vale.capture.stop()
          if (!bytesWritten) throw new Error('A captura não produziu quadros de vídeo.')
          setStatus(next === 'record' ? 'Gravação salva.' : 'Envio encerrado.')
        } catch (error) {
          await media.cancel().catch(() => undefined)
          await window.vale.capture.stop().catch(() => undefined)
          report(failure ?? error)
        } finally { finishOutput.current = undefined; setMode(undefined); setBusy(false) }
      }
      const draw = () => {
        if (pending || stopping || previewVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
        pending = Promise.resolve().then(async () => {
          context.drawImage(previewVideo, 0, 0, canvas.width, canvas.height)
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
      setStatus(next === 'record' ? 'Gravação em andamento.' : 'Envio iniciado. Confira a recepção no painel da plataforma.')
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
        {sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <label><input type="checkbox" checked={systemAudio} disabled={!!stream || busy} onChange={(event) => setSystemAudio(event.target.checked)} /> Áudio do PC</label>
      <label><input type="checkbox" checked={microphone} disabled={!!stream || busy} onChange={(event) => setMicrophone(event.target.checked)} /> Microfone</label>
      <button className="button primary" disabled={!selected || !!stream || busy} onClick={() => void preview()}>Iniciar prévia</button>
    </div>
    <video ref={video} hidden={!stream} autoPlay muted playsInline aria-label="Prévia da captura" />
    <div className="production-actions">
      <button className="button record" disabled={!stream || !!mode || busy} onClick={() => void start('record')}>Gravar WebM</button>
      <button className="button secondary" onClick={() => setShowLive(!showLive)}>Live direta</button>
      {mode && <button className="button danger" disabled={busy} onClick={() => finishOutput.current?.()}>Finalizar {mode === 'record' ? 'gravação' : 'live'}</button>}
      <button className="button secondary" disabled={!stream || !!mode || busy} onClick={() => { sourceCleanup.current?.(); sourceCleanup.current = undefined; setStream(undefined); setSelected(''); setStatus('Captura encerrada.') }}>Encerrar prévia</button>
    </div>
    {showLive && <form className="native-live" onSubmit={(event) => { event.preventDefault(); void start('live') }}>
      <p>Requer FFmpeg no PATH do Windows. Use o endereço e a chave de um destino RTMP/RTMPS.</p>
      <input aria-label="Servidor RTMP" placeholder="rtmps://servidor/app" required value={url} onChange={(event) => setUrl(event.target.value)} />
      <input aria-label="Chave da live direta" placeholder="Chave da live" type="password" autoComplete="off" required value={key} onChange={(event) => setKey(event.target.value)} />
      <button className="button primary" disabled={!stream || !!mode || busy}>Iniciar envio direto</button>
    </form>}
    <p role="status">{status}</p>
  </section>
}
