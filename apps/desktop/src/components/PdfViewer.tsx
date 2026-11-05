import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

type PdfLike = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number }
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }
  }>
  destroy: () => Promise<void>
}

type Props = {
  bytes: Uint8Array
  filename: string
  fullScreen?: boolean
}

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export function PdfViewer({ bytes, filename, fullScreen = false }: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const documentRef = useRef<PdfLike | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [zoom, setZoom] = useState(fullScreen ? 1.35 : 0.92)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let disposed = false
    setPage(1)
    setError(undefined)
    ;(async () => {
      try {
        const task = pdfjs.getDocument({ data: bytes.slice() })
        const doc = (await task.promise) as unknown as PdfLike
        if (disposed) return void doc.destroy()
        documentRef.current = doc
        setPages(doc.numPages)
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o PDF.')
      }
    })()
    return () => {
      disposed = true
      const doc = documentRef.current
      documentRef.current = null
      if (doc) void doc.destroy()
    }
  }, [bytes])

  useEffect(() => {
    const canvas = canvasRef.current
    const doc = documentRef.current
    if (!canvas || !doc || !pages) return
    let cancelled = false
    ;(async () => {
      try {
        const pdfPage = await doc.getPage(page)
        const viewport = pdfPage.getViewport({ scale: zoom })
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas indisponível.')
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        context.clearRect(0, 0, viewport.width, viewport.height)
        const task = pdfPage.render({ canvasContext: context, viewport })
        await task.promise
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao renderizar a página.')
      }
    })()
    return () => { cancelled = true }
  }, [page, pages, zoom])

  useEffect(() => {
    if (!fullScreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') setPage((value) => Math.min(pages, value + 1))
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') setPage((value) => Math.max(1, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullScreen, pages])

  return (
    <section className={fullScreen ? 'pdf-viewer presenter-viewer' : 'pdf-viewer'} aria-label={`Apresentação ${filename}`}>
      <div className="pdf-toolbar">
        <strong>{filename}</strong>
        <div className="pdf-controls">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Anterior</button>
          <label>Página <input aria-label="Ir para página" type="number" min="1" max={pages || 1} value={page} onChange={(event) => setPage(Math.min(Math.max(1, Number(event.target.value)), pages || 1))} /> / {pages || '…'}</label>
          <button disabled={!pages || page >= pages} onClick={() => setPage((value) => value + 1)}>Próxima →</button>
          <button onClick={() => setZoom((value) => Math.max(0.5, value - 0.15))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}>+</button>
        </div>
      </div>
      {error ? <div className="empty-state error-state">{error}</div> : <div className="pdf-canvas-wrap"><canvas ref={canvasRef} /></div>}
    </section>
  )
}
