import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Vault = Record<string, string>

/** Stores only encrypted values. If platform crypto is unavailable, secrets stay session-only. */
export class SecurityStore {
  private readonly filePath = join(app.getPath('userData'), 'secure-store.json')
  private loaded = false
  private values: Vault = {}

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      this.values = JSON.parse(await readFile(this.filePath, 'utf8')) as Vault
    } catch {
      this.values = {}
    }
  }

  async set(name: string, plaintext: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('A proteção de credenciais do Windows não está disponível nesta sessão.')
    }
    await this.load()
    this.values[name] = safeStorage.encryptString(plaintext).toString('base64')
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.values), { encoding: 'utf8', mode: 0o600 })
  }

  async get(name: string): Promise<string | undefined> {
    await this.load()
    const encoded = this.values[name]
    if (!encoded || !safeStorage.isEncryptionAvailable()) return undefined
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  }
}
