import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const target = process.argv[2]
const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
const output = resolve(process.env.VALE_VERIFICATION_DIR ?? '../../release/verification')
await mkdir(output, { recursive: true })
const app = await electron.launch(target
  ? { executablePath: resolve(target), env: environment }
  : { args: ['.'], env: environment })
const checks = []
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(15_000)
  await page.getByRole('button', { name: 'Iniciar aula', exact: false }).waitFor()
  const bridge = await page.evaluate(() => Boolean(window.vale?.app && window.vale?.obs))
  if (!bridge) throw new Error('Preload bridge missing')
  checks.push('Interface inicial e ponte local carregadas')
  const status = await page.evaluate(() => window.vale.app.getStatus())
  if (status.platform !== 'win32') throw new Error('Windows IPC failed')
  checks.push('IPC nativo Windows respondeu')
  for (const name of ['Produção', 'Apresentações', 'Destinos', 'Configurações', 'Ajuda', 'Início']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: false }).click()
    await page.getByRole('heading', { name, exact: true }).waitFor()
    checks.push(`Navegação: ${name}`)
  }
  await page.getByRole('button', { name: 'Criar reunião', exact: false }).click()
  await page.getByRole('dialog').waitFor()
  const invite = await page.getByRole('dialog').locator('input').first().inputValue()
  if (!invite.startsWith('https://vdo.ninja/')) throw new Error('Invalid meeting URL')
  checks.push('Criação real de convite via IPC')
  await page.getByRole('dialog').locator('.modal-close').click()
  if (!process.env.VALE_TEST_SLIDES_ONLY) {
  await page.getByRole('navigation').getByRole('button', { name: 'Produção' }).click()
  await app.evaluate(async ({ BrowserWindow }) => {
    const target = new BrowserWindow({ width: 640, height: 480 })
    const html = '<title>VALE Capture Test</title><style>body{background:royalblue;color:white}h1{animation:move 1s infinite alternate}@keyframes move{to{transform:translateY(100px)}}</style><h1>VALE Capture Test</h1>'
    await target.loadURL(`data:text/html,${encodeURIComponent(html)}`)
  })
  await page.bringToFront()
  await page.getByRole('button', { name: 'Listar telas e janelas' }).click()
  const source = page.getByLabel('Tela ou janela')
  await source.getByText('VALE Capture Test', { exact: true }).waitFor({ state: 'attached' })
  await source.selectOption({ label: 'VALE Capture Test' })
  await page.getByRole('button', { name: 'Iniciar prévia' }).click()
  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.videoWidth > 0 && video.readyState >= 2 && !video.paused
    })
  } catch (error) {
    const status = await page.getByLabel('Produção independente').getByRole('status').textContent()
    const video = await page.locator('video').evaluate((element) => ({
      width: element.videoWidth, readyState: element.readyState, paused: element.paused, time: element.currentTime
    }))
    throw new Error(`${status} ${JSON.stringify(video)}`, { cause: error })
  }
  checks.push('Captura real de janela e prévia sem OBS')
  const recording = resolve(output, 'windows-test.webm')
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, recording)
  await page.getByRole('button', { name: 'Gravar WebM' }).click()
  await page.getByText('Gravação em andamento.', { exact: true }).waitFor()
  await new Promise((done) => setTimeout(done, 2200))
  await page.getByRole('button', { name: 'Finalizar gravação' }).click()
  try {
    await page.getByText('Gravação salva.', { exact: true }).waitFor()
  } catch (error) {
    throw new Error(await page.getByLabel('Produção independente').getByRole('status').textContent(), { cause: error })
  }
  const webm = await readFile(recording)
  if (webm.length < 1024 || webm.readUInt32BE(0) !== 0x1a45dfa3) throw new Error('Gravação WebM inválida.')
  await page.evaluate(async (bytes) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/webm' }))
    const player = document.createElement('video')
    try {
      await new Promise((resolve, reject) => {
        player.onloadeddata = resolve
        player.onerror = () => reject(new Error('O WebM não pôde ser decodificado.'))
        player.src = url
      })
      if (!player.videoWidth) throw new Error('O WebM está sem imagem.')
    } finally { URL.revokeObjectURL(url) }
  }, [...webm])
  checks.push('Gravação WebM salva e decodificada sem OBS')
  if (process.env.VALE_TEST_FFMPEG) {
    const flv = resolve(output, 'windows-test.flv')
    const receiver = spawn(process.env.VALE_TEST_FFMPEG, ['-hide_banner', '-loglevel', 'error',
      '-listen', '1', '-timeout', '15', '-i', 'rtmp://127.0.0.1:19357/live/vale-test', '-c', 'copy', '-y', flv],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let diagnostics = ''
    receiver.stderr.on('data', (data) => { diagnostics += data.toString() })
    const closed = new Promise((done) => receiver.once('close', done))
    try {
      await new Promise((done) => setTimeout(done, 1200))
      await page.getByRole('button', { name: 'Live direta', exact: true }).click()
      await page.getByLabel('Servidor RTMP').fill('rtmp://127.0.0.1:19357/live')
      await page.getByLabel('Chave da live direta').fill('vale-test')
      await page.getByRole('button', { name: 'Iniciar envio direto' }).click()
      await page.getByText('Envio iniciado.', { exact: false }).waitFor()
      await new Promise((done) => setTimeout(done, 8000))
      await page.getByRole('button', { name: 'Finalizar live' }).click()
      await page.getByText('Envio encerrado.', { exact: true }).waitFor()
      const code = await closed
      const bytes = await readFile(flv)
      if (code !== 0 || bytes.length < 1024 || bytes.subarray(0, 3).toString() !== 'FLV') {
        throw new Error(`O receptor RTMP não gravou a live: ${diagnostics}`)
      }
      checks.push('Live direta recebida por RTMP local, sem OBS')
    } finally {
      if (receiver.exitCode === null) receiver.kill()
    }
  }
  await page.getByRole('button', { name: 'Encerrar prévia' }).click()
  }
  if (process.env.VALE_TEST_FIXTURES) {
    for (const extension of (process.env.VALE_TEST_FORMATS ?? 'ppt,pptx').split(',')) {
      const fixture = resolve(process.env.VALE_TEST_FIXTURES, `slides.${extension}`)
      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
      }, fixture)
      await page.getByRole('navigation').getByRole('button', { name: 'Apresentações' }).click()
      await page.getByRole('button', { name: 'Abrir apresentação', exact: false }).first().click()
      const viewer = page.getByLabel(`Apresentação slides.${extension}`)
      try {
        await viewer.getByRole('button', { name: 'Próxima' }).waitFor({ timeout: 260_000 })
      } catch (error) {
        throw new Error(await page.locator('.workspace').innerText(), { cause: error })
      }
      await viewer.getByRole('button', { name: 'Próxima' }).click()
      if (await viewer.getByLabel('Ir para página').inputValue() !== '2') throw new Error('O segundo slide não abriu.')
      await viewer.locator('canvas').waitFor()
      const opened = app.waitForEvent('window', { timeout: 15_000 })
      await page.getByRole('button', { name: 'Abrir janela de apresentação' }).click()
      const presenter = await opened
      await presenter.getByLabel(`Apresentação slides.${extension}`).getByRole('button', { name: 'Próxima' }).click()
      await presenter.close()
      checks.push(`${extension.toUpperCase()} aberto e navegado na interface e no apresentador`)
    }
  }
  await writeFile(resolve(output, 'windows-smoke.json'), JSON.stringify({ target: target ?? 'development build', checks, status, passed: true }, null, 2))
  console.log(JSON.stringify({ passed: true, checks }))
} finally {
  await app.close()
}
