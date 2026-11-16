import { app, dialog } from 'electron'
import { open } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { AppApi } from '../../shared/contracts'

type Output = { write: (bytes: Uint8Array) => Promise<void>; close: () => Promise<void> }
type Options = Parameters<AppApi['capture']['start']>[0]

export class CaptureOutput {
  private output?: Output
  private recording?: Output
  private liveFailed = false
  private liveQueue = Promise.resolve()
  private queuedBytes = 0
  private opening = false

  async start(options: Options): Promise<boolean> {
    if (this.output || this.recording || this.opening) throw new Error('Já existe uma saída em uso.')
    this.opening = true
    this.liveFailed = false
    try {
      if (options.mode === 'record' || (options.mode === 'live' && options.record)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Salvar gravação',
          defaultPath: join(app.getPath('videos'), `VALE-${stamp}.webm`),
          filters: [{ name: 'Vídeo WebM', extensions: ['webm'] }]
        })
        if (canceled || !filePath) return false
        const file = await open(filePath, 'w')
        this.recording = { write: async (bytes) => { await file.writeFile(bytes) }, close: () => file.close() }
      }
      if (options.mode === 'live') {
        const url = new URL(options.url)
        if (!['rtmp:', 'rtmps:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash ||
            !/^[A-Za-z0-9_.~-]{1,512}$/.test(options.key)) throw new Error('Informe um servidor RTMP/RTMPS e uma chave válidos.')
        const destination = url.href.replace(/\/$/, '') + '/' + options.key
        const bundled = join(process.resourcesPath, 'encoder', 'ffmpeg.exe')
        const executable = existsSync(bundled) ? bundled : 'ffmpeg.exe'
        const processHandle = spawn(executable, ['-hide_banner', '-loglevel', 'error', '-rw_timeout', '8000000', '-f', 'webm', '-i', 'pipe:0',
          '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-g', '60', '-b:v', '3500k', '-maxrate', '3500k', '-bufsize', '7000k',
          '-c:a', 'aac', '-b:a', '128k', '-f', 'flv', destination],
        { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] })
        let failed = false
        processHandle.stdin.on('error', () => { failed = true })
        processHandle.on('error', () => { failed = true })
        const exited = new Promise<number | null>((resolve) => processHandle.once('close', resolve))
        await new Promise<void>((resolve, reject) => {
          processHandle.once('spawn', resolve)
          processHandle.once('error', () => reject(new Error('Encoder FFmpeg indisponível. Repare a instalação do VALE.')))
        })
        const liveError = () => new Error('O FFmpeg encerrou a transmissão. Confira a URL, a chave e o painel da plataforma.')
        this.output = {
          write: (bytes) => new Promise((resolve, reject) => {
            if (failed || !processHandle.stdin.writable || processHandle.exitCode !== null) return reject(liveError())
            processHandle.stdin.write(bytes, (error) => error ? reject(liveError()) : resolve())
          }),
          close: async () => {
            processHandle.stdin.end()
            const timer = setTimeout(() => processHandle.kill(), 8000)
            try { if (await exited !== 0) throw liveError() } finally { clearTimeout(timer) }
          }
        }
      } else if (options.mode !== 'record') {
        throw new Error('Saída inválida.')
      }
      return true
    } catch (error) {
      await this.stop().catch(() => undefined)
      throw error
    } finally {
      this.opening = false
    }
  }

  async write(bytes: Uint8Array): Promise<{ liveFailed: boolean }> {
    if ((!this.output && !this.recording) || !(bytes instanceof Uint8Array) || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Pacote de mídia inválido.')
    if (!this.recording) {
      await this.output?.write(bytes)
      return { liveFailed: false }
    }
    await this.recording.write(bytes)
    const live = this.output
    if (live && !this.liveFailed) {
      if (this.queuedBytes + bytes.byteLength > 8 * 1024 * 1024) this.liveFailed = true
      else {
        this.queuedBytes += bytes.byteLength
        this.liveQueue = this.liveQueue.then(async () => {
          if (!this.liveFailed) await live.write(bytes)
        }).catch(() => { this.liveFailed = true }).finally(() => { this.queuedBytes -= bytes.byteLength })
      }
    }
    return { liveFailed: this.liveFailed }
  }

  async stop(): Promise<{ liveFailed: boolean }> {
    const output = this.output
    const recording = this.recording
    try {
      await recording?.close()
    } finally {
      try {
        if (recording && !this.liveFailed) {
          let timeout: ReturnType<typeof setTimeout> | undefined
          try {
            await Promise.race([this.liveQueue, new Promise<void>((resolve) => {
              timeout = setTimeout(() => { this.liveFailed = true; resolve() }, 3000)
            })])
          } finally { clearTimeout(timeout) }
        }
        await output?.close().catch((error) => {
          if (!recording) throw error
          this.liveFailed = true
        })
        await this.liveQueue
      } finally {
        this.output = undefined
        this.recording = undefined
      }
    }
    return { liveFailed: this.liveFailed }
  }
}
