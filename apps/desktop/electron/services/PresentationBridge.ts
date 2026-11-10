import { app, BrowserWindow, dialog, shell } from 'electron'
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import type { PresentationFile } from '../../shared/contracts'

const execFileAsync = promisify(execFile)
const allowedExtensions = ['.pdf', '.ppt', '.pptx']

export class PresentationBridge {
  private currentFile: PresentationFile | null = null
  private readonly tempRoot = mkdtemp(join(app.getPath('temp'), 'vale-stream-studio-'))

  async openOriginalFromDialog(): Promise<void> {
    const result = await dialog.showOpenDialog({
      title: 'Abrir apresentação no programa do Windows',
      properties: ['openFile'],
      filters: [{ name: 'PowerPoint', extensions: ['ppt', 'pptx'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return
    if (!['.ppt', '.pptx'].includes(extname(path).toLowerCase())) throw new Error('Selecione um PPT ou PPTX.')
    const bundled = join(process.resourcesPath, 'slides-engine', 'program', 'soffice.exe')
    try { await access(bundled) } catch {
      if (await shell.openPath(path)) throw new Error('O Windows não conseguiu abrir o arquivo. Use o instalador VALE com o motor de slides.')
      return
    }
    const profile = await mkdtemp(join(await this.tempRoot, 'show-'))
    const slideshow = spawn(bundled, [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--show', path], { stdio: 'ignore', windowsHide: true })
    await new Promise<void>((resolve, reject) => {
      slideshow.once('spawn', resolve)
      slideshow.once('error', () => reject(new Error('Não foi possível abrir a apresentação original.')))
    })
  }

  async importFromDialog(): Promise<PresentationFile | null> {
    const result = await dialog.showOpenDialog({
      title: 'Abrir apresentação local',
      properties: ['openFile'],
      filters: [{ name: 'Apresentações', extensions: ['pdf', 'ppt', 'pptx'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    this.currentFile = await this.load(result.filePaths[0])
    return this.currentFile
  }

  async current(): Promise<PresentationFile | null> {
    return this.currentFile
  }

  async read(path: string): Promise<Uint8Array> {
    if (!this.currentFile || path !== this.currentFile.path) throw new Error('A apresentação solicitada não está aberta nesta sessão.')
    return new Uint8Array(await readFile(path))
  }

  async openPresenter(parent: BrowserWindow, load: (window: BrowserWindow) => Promise<void>): Promise<void> {
    if (!this.currentFile) throw new Error('Abra uma apresentação antes de iniciar a tela do apresentador.')
    const window = new BrowserWindow({
      parent,
      minWidth: 840,
      minHeight: 560,
      width: 1280,
      height: 800,
      title: 'VALE STREAM STUDIO - Apresentação',
      backgroundColor: '#0b0e14',
      webPreferences: {
        preload: join(__dirname, '../preload/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    window.setMenuBarVisibility(false)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    await load(window)
  }

  async cleanup(): Promise<void> {
    await rm(await this.tempRoot, { recursive: true, force: true })
  }

  private async load(originalPath: string): Promise<PresentationFile> {
    const ext = extname(originalPath).toLowerCase()
    if (!allowedExtensions.includes(ext)) throw new Error('Selecione somente PDF, PPT ou PPTX.')
    if (ext === '.pdf') {
      return { path: originalPath, filename: basename(originalPath), kind: 'pdf', converted: false }
    }
    const convertedPath = await this.convertWithLibreOffice(originalPath)
    return {
      path: convertedPath,
      filename: basename(originalPath),
      kind: ext.slice(1) as 'ppt' | 'pptx',
      converted: true,
      notice: 'Os slides foram renderizados localmente. A apresentação interna exibe páginas estáticas. Animações e vídeos exigem o modo original.'
    }
  }

  private async convertWithLibreOffice(input: string): Promise<string> {
    const soffice = await this.findSoffice()
    if (!soffice) {
      throw new Error('Instale o LibreOffice Impress para importar PPT/PPTX aqui. Se já tem PowerPoint, use “Abrir original” e capture sua janela em Produção.')
    }
    const directory = await mkdtemp(join(await this.tempRoot, 'slides-'))
    const profile = join(directory, 'profile')
    await mkdir(profile)
    try {
      await execFileAsync(soffice, [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--convert-to', 'pdf:impress_pdf_Export', '--outdir', directory, input], {
        timeout: 240_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      })
    } catch (error) {
      throw new Error(`Falha ao converter a apresentação localmente: ${error instanceof Error ? error.message.slice(0, 180) : 'erro desconhecido'}`)
    }
    const output = join(directory, `${basename(input, extname(input))}.pdf`)
    try {
      await access(output)
      return output
    } catch {
      throw new Error('O LibreOffice terminou sem gerar o PDF esperado. Tente abrir o arquivo original e compartilhar a janela.')
    }
  }

  private async findSoffice(): Promise<string | undefined> {
    const candidates = [
      join(process.resourcesPath, 'slides-engine', 'program', 'soffice.com'),
      join(process.resourcesPath, 'slides-engine', 'program', 'soffice.exe'),
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ]
    for (const candidate of candidates) {
      try {
        await access(candidate)
        return candidate
      } catch {
        // Continue with the next known install location.
      }
    }
    try {
      const { stdout } = await execFileAsync('where.exe', ['soffice.com', 'soffice.exe'], { windowsHide: true })
      const resolved = stdout.split(/\r?\n/).find(Boolean)
      return resolved?.trim()
    } catch {
      return undefined
    }
  }
}
