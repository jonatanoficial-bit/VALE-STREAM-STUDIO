import { _electron as electron } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const clip = process.argv[2]
if (!clip) throw new Error('Informe um vídeo de teste com fundo azul e áudio.')
const target = process.argv[3]
const output = resolve('../../release/verification-media')
await mkdir(output, { recursive: true })
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch(target ? { executablePath: resolve(target), env } : { args: ['.'], env })
const recording = resolve(output, 'branded-video.webm')

try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.screenshot({ path: resolve(output, 'studio-home.png'), fullPage: true })
  await page.getByRole('navigation').getByRole('button', { name: 'Produção' }).click()
  await page.screenshot({ path: resolve(output, 'studio-production.png'), fullPage: true })
  const logo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')
    context.fillStyle = '#ff2020'
    context.fillRect(0, 0, 64, 64)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByLabel('Adicionar vídeos e imagens').setInputFiles(clip)
  await page.getByLabel('Adicionar logotipo').setInputFiles({ name: 'marca-teste.png', mimeType: 'image/png', buffer: Buffer.from(logo, 'base64') })
  await page.getByLabel('Faixa de identificação').fill('VALE • Teste de composição')
  await page.getByRole('button', { name: 'Iniciar prévia' }).click()
  await page.getByRole('button', { name: 'Reproduzir vídeo' }).click()
  await page.getByLabel('Repetir').check()
  await page.waitForFunction(() => Number(document.querySelector('meter[aria-label="Áudio do vídeo"]')?.getAttribute('value')) > -55)
  await page.waitForFunction(() => {
    const context = document.querySelector('.studio-program').getContext('2d')
    const [red, , blue] = context.getImageData(1180, 80, 1, 1).data
    const [, , centerBlue] = context.getImageData(640, 360, 1, 1).data
    return red > 150 && blue < 90 && centerBlue > 130
  })
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, recording)
  await page.getByRole('button', { name: 'Gravar WebM' }).click()
  await page.getByText('Gravação em andamento.', { exact: true }).waitFor()
  await page.screenshot({ path: resolve(output, 'studio-recording.png'), fullPage: true })
  await new Promise((done) => setTimeout(done, 2400))
  await page.getByRole('button', { name: 'Finalizar gravação' }).click()
  await page.getByText('Gravação salva.', { exact: true }).waitFor()
  const bytes = await readFile(recording)
  const encoder = process.env.VALE_TEST_FFMPEG
  const colors = encoder ? (() => {
    const result = spawnSync(encoder, ['-v', 'error', '-i', recording, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
    if (result.status !== 0 || result.stdout.length !== 1280 * 720 * 3) throw new Error('Não foi possível decodificar a gravação de teste.')
    return [result.stdout[(80 * 1280 + 1180) * 3], result.stdout[(360 * 1280 + 640) * 3 + 2]]
  })() : await page.evaluate(async (data) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'video/webm' }))
    const video = document.createElement('video')
    try {
      await new Promise((resolve, reject) => {
        video.onloadeddata = () => {
          video.onseeked = resolve
          video.currentTime = 0.05
        }
        video.onerror = reject
        video.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      context.drawImage(video, 0, 0)
      return [context.getImageData(1180, 80, 1, 1).data[0], context.getImageData(640, 360, 1, 1).data[2]]
    } finally { URL.revokeObjectURL(url) }
  }, [...bytes])
  if (colors[0] < 150 || colors[1] < 130) throw new Error(`A gravação não contém o vídeo e o logotipo nos locais esperados: ${JSON.stringify(colors)}`)
  console.log('Prévia e WebM conferidos por pixels: vídeo e logotipo. Medidor do clipe respondeu.')
} finally {
  await app.close()
}
