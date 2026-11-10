import { app, dialog } from 'electron'
import { open } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { AppApi } from '../../shared/contracts'

type Output = { write: (bytes: Uint8Array) => Promise<void>; close: () => Promise<void> }
type Options = Parameters<AppApi['capture']['start']>[0]

export class CaptureOutput {
  private output?: Output
  private opening = false

  async start(options: Options): Promise<boolean> {
    if (this.output || this.opening) throw new Error('Já existe uma saída em uso.')
    this.opening = true
    try {
      if (options.mode === 'record') {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Salvar gravação',
          defaultPath: join(app.getPath('videos'), `VALE-${stamp}.webm`),
          filters: [{ name: 'Vídeo WebM', extensions: ['webm'] }]
        })
        if (canceled || !filePath) return false
        const file = await open(filePath, 'w')
        this.output = { write: async (bytes) => { await file.writeFile(bytes) }, close: () => file.close() }
      } else if (options.mode === 'live') {
        const url = new URL(options.url)
        if (!['rtmp:', 'rtmps:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash ||
            !/^[A-Za-z0-9_.~-]{1,512}$/.test(options.key)) throw new Error('Informe um servidor RTMP/RTMPS e uma chave válidos.')
        const destination = url.href.replace(/\/$/, '') + '/' + options.key
        const process = spawn('ffmpeg.exe', ['-hide_banner', '-loglevel', 'error', '-f', 'webm', '-i', 'pipe:0',
          '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-g', '60', '-b:v', '3500k', '-maxrate', '3500k', '-bufsize', '7000k',
          '-c:a', 'aac', '-b:a', '128k', '-f', 'flv', destination],
        { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] })
        let failed = false
        process.stdin.on('error', () => { failed = true })
        process.on('error', () => { failed = true })
        const exited = new Promise<number | null>((resolve) => process.once('close', resolve))
        await new Promise<void>((resolve, reject) => {
          process.once('spawn', resolve)
          process.once('error', () => reject(new Error('FFmpeg não encontrado. Instale uma versão com libx264 e adicione-a ao PATH do Windows.')))
        })
        const liveError = () => new Error('O FFmpeg encerrou a transmissão. Confira a URL, a chave e o painel da plataforma.')
        this.output = {
          write: (bytes) => new Promise((resolve, reject) => {
            if (failed || !process.stdin.writable || process.exitCode !== null) return reject(liveError())
            process.stdin.write(bytes, (error) => error ? reject(liveError()) : resolve())
          }),
          close: async () => {
            process.stdin.end()
            const timer = setTimeout(() => process.kill(), 8000)
            try { if (await exited !== 0) throw liveError() } finally { clearTimeout(timer) }
          }
        }
      } else {
        throw new Error('Saída inválida.')
      }
      return true
    } finally {
      this.opening = false
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.output || !(bytes instanceof Uint8Array) || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Pacote de mídia inválido.')
    await this.output.write(bytes)
  }

  async stop(): Promise<void> {
    const output = this.output
    try { await output?.close() } finally { this.output = undefined }
  }
}
