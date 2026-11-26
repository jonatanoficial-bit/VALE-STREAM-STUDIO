import { _electron as electron } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const application = await electron.launch({ args: ['scripts/brand-renderer.cjs'], env })
try {
  const page = await application.firstWindow()
  const source = await readFile('../../branding/vale-app-icon.svg', 'utf8')
  const images = []
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    const encoded = await page.evaluate(async ({ source, size }) => {
      const image = new Image()
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d').drawImage(image, 0, 0, size, size)
      return canvas.toDataURL('image/png').split(',')[1]
    }, { source, size })
    images.push({ size, png: Buffer.from(encoded, 'base64') })
  }
  const directory = resolve('build')
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'icon.png'), images.at(-1).png)
  const entries = images.filter(({ size }) => size <= 256)
  const header = Buffer.alloc(6 + entries.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, png }, index) => {
    const at = 6 + index * 16
    header[at] = header[at + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  await writeFile(resolve(directory, 'icon.ico'), Buffer.concat([header, ...entries.map(({ png }) => png)]))
  const wordmark = await readFile('../../branding/vale-logo-horizontal.svg', 'utf8')
  const png = await page.evaluate(async (source) => {
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 512
    canvas.getContext('2d').drawImage(image, 0, 0, 1920, 512)
    return canvas.toDataURL('image/png').split(',')[1]
  }, wordmark)
  await writeFile(resolve('../../branding/vale-logo-horizontal.png'), Buffer.from(png, 'base64'))
  await page.setViewportSize({ width: 1200, height: 680 })
  await page.setContent(`<html><body style="margin:0;background:#121817;color:#b6d8cb;font:12px 'Segoe UI',sans-serif"><main style="padding:60px"><div style="letter-spacing:4px;color:#83988b">VALE / IDENTIDADE DO ESTÚDIO</div><section style="display:flex;gap:60px;align-items:center;margin-top:58px"><img width="250" height="250" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}"><div><img width="690" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(wordmark)}"><p style="margin:24px 0 0 58px;color:#96aa9e;letter-spacing:2px;font-size:10px">CAPTURE. CRIE. TRANSMITA.</p></div></section><footer style="margin-top:85px;border-top:1px solid #36473c;padding-top:25px;display:flex;gap:35px;letter-spacing:2px;font-size:9px"><span>GRAFITE / #121817</span><span>VERDE CLARO / #B6D8CB</span><span>VERDE MÉDIO / #7D9E8D</span></footer></main></body></html>`)
  await page.screenshot({ path: resolve('../../branding/vale-brand-preview.png') })
  console.log('Ícones VALE gerados: PNG 512px e ICO com sete resoluções.')
} finally { await application.close() }
