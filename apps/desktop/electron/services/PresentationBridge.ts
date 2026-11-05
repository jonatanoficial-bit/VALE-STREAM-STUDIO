import { app, BrowserWindow, dialog } from 'electron'
import { access, mkdir, readFile, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { PresentationFile } from '../../shared/contracts'

const execFileAsync = promisify(execFile)
const allowedExtensions = ['.pdf', '.ppt', '.pptx']

export class PresentationBridge {
  private currentFile: PresentationFile | null = null
  private readonly tempRoot = join(app.getPath('temp'), 'vale-stream-studio')

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
        preload: join(__dirname, '../preload/preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    await load(window)
  }

  async cleanup(): Promise<void> {
    await rm(this.tempRoot, { recursive: true, force: true })
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
      notice: 'PPT/PPTX foi convertido localmente pelo LibreOffice. Animações, vídeos e fontes especiais podem não ser preservados; use a opção de compartilhar a janela original se necessário.'
    }
  }

  private async convertWithLibreOffice(input: string): Promise<string> {
    const soffice = await this.findSoffice()
    if (!soffice) {
      throw new Error('LibreOffice não foi encontrado. Instale gratuitamente pelo site oficial ou abra o arquivo original e compartilhe a janela pelo OBS.')
    }
    await mkdir(this.tempRoot, { recursive: true })
    try {
      await execFileAsync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', this.tempRoot, input], {
        timeout: 120_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      })
    } catch (error) {
      throw new Error(`Falha ao converter a apresentação localmente: ${error instanceof Error ? error.message.slice(0, 180) : 'erro desconhecido'}`)
    }
    const output = join(this.tempRoot, `${basename(input, extname(input))}.pdf`)
    try {
      await access(output)
      return output
    } catch {
      throw new Error('O LibreOffice terminou sem gerar o PDF esperado. Tente abrir o arquivo original e compartilhar a janela.')
    }
  }

  private async findSoffice(): Promise<string | undefined> {
    const candidates = [
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
      const { stdout } = await execFileAsync('where.exe', ['soffice.exe'], { windowsHide: true })
      const resolved = stdout.split(/\r?\n/).find(Boolean)
      return resolved?.trim()
    } catch {
      return undefined
    }
  }
}

