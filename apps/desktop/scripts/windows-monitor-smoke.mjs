import { _electron as electron } from 'playwright'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['.'], env })
try {
  const page = await app.firstWindow()
  await page.getByRole('navigation').getByRole('button', { name: 'Produção' }).click()
  await page.getByRole('button', { name: 'Listar telas e janelas' }).click()
  const sources = page.getByLabel('Tela ou janela')
  const monitor = sources.locator('option[value^="screen:"]').first()
  await monitor.waitFor({ state: 'attached' })
  await sources.selectOption({ value: await monitor.getAttribute('value') })
  await page.getByRole('button', { name: 'Iniciar prévia' }).click()
  const preview = page.getByLabel('Prévia da captura')
  await preview.waitFor()
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
  const surface = await preview.evaluate((element) => element.srcObject.getVideoTracks()[0].getSettings().displaySurface)
  if (surface && surface !== 'monitor') throw new Error(`Foi capturado ${surface}, em vez do monitor.`)
  await page.getByRole('button', { name: 'Encerrar prévia' }).click()
  console.log('Prévia do monitor inteiro aprovada. Nenhum quadro foi salvo.')
} finally {
  await app.close()
}
