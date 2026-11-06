import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

const target = process.argv[2]
const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
const output = resolve('../../release/verification')
await mkdir(output, { recursive: true })
const app = await electron.launch(target
  ? { executablePath: resolve(target), env: environment }
  : { args: ['.'], env: environment })
const checks = []
try {
  const page = await app.firstWindow()
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
  await page.screenshot({ path: resolve(output, 'windows-smoke.png') })
  await writeFile(resolve(output, 'windows-smoke.json'), JSON.stringify({ target: target ?? 'development build', checks, status, passed: true }, null, 2))
  console.log(JSON.stringify({ passed: true, checks }))
} finally {
  await app.close()
}

