export type SceneAsset = { id: string; name: string; url: string; kind: 'image' | 'video' }
export type LogoCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type ElementSource = HTMLImageElement | HTMLVideoElement

function dimensions(source: ElementSource | null) {
  if (!source) return undefined
  if (source instanceof HTMLVideoElement) {
    if (source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !source.videoWidth) return undefined
    return { width: source.videoWidth, height: source.videoHeight }
  }
  return source.complete && source.naturalWidth
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : undefined
}

function contain(context: CanvasRenderingContext2D, source: ElementSource | null, x: number, y: number, width: number, height: number) {
  const size = dimensions(source)
  if (!source || !size) return false
  const scale = Math.min(width / size.width, height / size.height)
  const w = size.width * scale
  const h = size.height * scale
  context.drawImage(source, x + (width - w) / 2, y + (height - h) / 2, w, h)
  return true
}

export function drawStudioScene(context: CanvasRenderingContext2D, scene: {
  capture: HTMLVideoElement | null
  camera: HTMLVideoElement | null
  media: ElementSource | null
  logo: HTMLImageElement | null
  corner: LogoCorner
  logoSize: number
  logoOpacity: number
  title: string
}) {
  const { width, height } = context.canvas
  const margin = Math.round(width * 0.025)
  context.fillStyle = '#0b0e14'
  context.fillRect(0, 0, width, height)
  if (!contain(context, scene.media, 0, 0, width, height)) contain(context, scene.capture, 0, 0, width, height)

  const camera = dimensions(scene.camera)
  if (scene.camera && camera) {
    const scale = Math.min(width * 0.23 / camera.width, height * 0.25 / camera.height)
    const w = camera.width * scale
    const h = camera.height * scale
    const x = width - w - margin
    const y = height - h - margin - (scene.title ? height * 0.12 : 0)
    context.fillStyle = '#0b0e14'
    context.fillRect(x - 3, y - 3, w + 6, h + 6)
    context.drawImage(scene.camera, x, y, w, h)
  }
  const logo = dimensions(scene.logo)
  if (scene.logo && logo) {
    const scale = Math.min(width * scene.logoSize / 100 / logo.width, height * 0.27 / logo.height)
    const w = logo.width * scale
    const h = logo.height * scale
    const x = scene.corner.endsWith('right') ? width - w - margin : margin
    let y = scene.corner.startsWith('bottom') ? height - h - margin - (scene.title ? height * 0.12 : 0) : margin
    if (scene.corner === 'bottom-right' && camera) y -= height * 0.27
    context.save()
    context.globalAlpha = scene.logoOpacity / 100
    context.drawImage(scene.logo, x, y, w, h)
    context.restore()
  }
  if (scene.title) {
    const barHeight = Math.round(height * 0.1)
    context.fillStyle = 'rgba(11, 14, 20, 0.88)'
    context.fillRect(margin, height - barHeight - margin, width - 2 * margin, barHeight)
    context.fillStyle = '#fff'
    context.font = `600 ${Math.round(height * 0.039)}px sans-serif`
    context.textBaseline = 'middle'
    context.fillText(scene.title, margin * 2, height - barHeight / 2 - margin, width - 4 * margin)
  }
}
