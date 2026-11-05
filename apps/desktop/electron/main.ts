import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ObsBridge } from './services/ObsBridge'
import { PresentationBridge } from './services/PresentationBridge'
import { SecurityStore } from './services/SecurityStore'
import { VdoNinjaBridge } from './services/VdoNinjaBridge'
import { assertSafeExternalUrl } from './services/validators'

let mainWindow: BrowserWindow | undefined
const obs = new ObsBridge()
const presentation = new PresentationBridge()
const meetings = new VdoNinjaBridge()
const security = new SecurityStore()

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

function getObsPath(): string | undefined {
  const candidates = [
    'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
    'C:\\Program Files (x86)\\obs-studio\\bin\\64bit\\obs64.exe'
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

async function loadRenderer(window: BrowserWindow, presenter = false): Promise<void> {
  if (isDev) {
    await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}${presenter ? '#/presenter' : ''}`)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), presenter ? { hash: '/presenter' } : undefined)
  }
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0b0e14',
    title: 'VALE STREAM STUDIO',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    const permitted = isDev ? url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '') : url.startsWith('file:')
    if (!permitted) event.preventDefault()
  })
  void loadRenderer(window)
  return window
}

function trustedSender(event: Electron.IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url
  const permitted = Boolean(url) && (isDev
    ? url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '')
    : url.startsWith('file:'))
  if (!permitted) throw new Error('Solicitação recusada por origem não confiável.')
}

function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown): void {
  ipcMain.handle(channel, async (event, ...args) => {
    trustedSender(event)
    return listener(event, ...args)
  })
}

function registerIpc(): void {
  obs.onState((state) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('obs:state', state)
  })

  handle('app:status', () => ({ platform: process.platform, obsExecutable: getObsPath() }))
  handle('app:openExternal', async (_event, rawUrl: string) => shell.openExternal(assertSafeExternalUrl(rawUrl).toString()))
  handle('app:openRecordingsFolder', () => shell.openPath(app.getPath('videos')))

  handle('obs:connect', async (_event, options: { host: string; port: number; password: string }) => {
    const result = await obs.connect(options)
    if (options.password) {
      try { await security.set('obs-websocket-password', options.password) } catch { /* session connection still remains valid */ }
    }
    return result
  })
  handle('obs:disconnect', () => obs.disconnect())
  handle('obs:snapshot', () => obs.snapshot())
  handle('obs:switchScene', (_event, sceneName: string) => obs.switchScene(sceneName))
  handle('obs:setMute', (_event, value: { inputName: string; muted: boolean }) => obs.setMute(value.inputName, value.muted))
  handle('obs:addInput', (_event, input) => obs.addInput(input))
  handle('obs:startRecord', () => obs.startRecord())
  handle('obs:stopRecord', () => obs.stopRecord())
  handle('obs:configureDestination', async (_event, destination) => {
    const result = await obs.configureDestination(destination)
    await security.set(`stream-key:${destination.platform}`, destination.key)
    return result
  })
  handle('obs:startStream', () => obs.startStream())
  handle('obs:stopStream', () => obs.stopStream())

  handle('presentation:import', () => presentation.importFromDialog())
  handle('presentation:read', (_event, path: string) => presentation.read(path))
  handle('presentation:current', () => presentation.current())
  handle('presentation:openPresenter', async () => {
    if (!mainWindow) throw new Error('Janela principal indisponível.')
    return presentation.openPresenter(mainWindow, (window) => loadRenderer(window, true))
  })

  handle('meeting:create', () => meetings.createRoom())
  handle('meeting:open', (_event, url: string) => shell.openExternal(assertSafeExternalUrl(url).toString()))
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  registerIpc()
  mainWindow = createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void presentation.cleanup()
})

