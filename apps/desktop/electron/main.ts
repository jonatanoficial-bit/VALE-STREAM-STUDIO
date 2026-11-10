import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ObsBridge } from './services/ObsBridge'
import { PresentationBridge } from './services/PresentationBridge'
import { SecurityStore } from './services/SecurityStore'
import { VdoNinjaBridge } from './services/VdoNinjaBridge'
import { assertSafeExternalUrl } from './services/validators'
import { CaptureOutput } from './services/CaptureOutput'
import { pathToFileURL } from 'node:url'

let mainWindow: BrowserWindow | undefined
const obs = new ObsBridge()
const presentation = new PresentationBridge()
const meetings = new VdoNinjaBridge()
const security = new SecurityStore()
const capture = new CaptureOutput()
let sources: Electron.DesktopCapturerSource[] = []
let selected: { source: Electron.DesktopCapturerSource; expires: number } | undefined

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const rendererPath = join(__dirname, '../renderer/index.html')

function isStudioUrl(value: string): boolean {
  const url = value.split('#')[0]
  const expected = isDev ? new URL('/', process.env.ELECTRON_RENDERER_URL).href : pathToFileURL(rendererPath).href
  return url === expected
}

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
    await window.loadFile(rendererPath, presenter ? { hash: '/presenter' } : undefined)
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
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: true,
      webSecurity: true
    }
  })
  window.setMenuBarVisibility(false)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isStudioUrl(url)) event.preventDefault()
  })
  void loadRenderer(window)
  return window
}

function trustedSender(event: Electron.IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url
  const permitted = !!url && event.senderFrame === event.sender.mainFrame && isStudioUrl(url)
  if (!permitted) throw new Error('Solicitação recusada por origem não confiável.')
}

function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown): void {
  ipcMain.handle(channel, async (event, ...args) => {
    trustedSender(event)
    return listener(event, ...args)
  })
}

function registerIpc(): void {
  function assertMain(event: Electron.IpcMainInvokeEvent): void {
    if (event.sender !== mainWindow?.webContents) throw new Error('Abra a captura na janela principal.')
  }
  handle('capture:sources', async (event) => {
    assertMain(event)
    sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
    return sources.map(({ id, name }) => ({ id, name }))
  })
  handle('capture:select', (event, id: string) => {
    assertMain(event)
    const source = sources.find((item) => item.id === id)
    if (!source) throw new Error('Atualize a lista e selecione uma tela ou janela.')
    selected = { source, expires: Date.now() + 120_000 }
  })
  handle('capture:start', (event, options) => { assertMain(event); return capture.start(options) })
  handle('capture:write', (event, bytes) => { assertMain(event); return capture.write(bytes) })
  handle('capture:stop', (event) => { assertMain(event); return capture.stop() })
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
  handle('presentation:original', () => presentation.openOriginalFromDialog())
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
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === mainWindow?.webContents && isStudioUrl(contents.getURL()) &&
      (permission === 'display-capture' || (permission === 'media' && 'mediaTypes' in details &&
        ((details.mediaTypes?.length === 0 && !!selected && selected.expires >= Date.now()) ||
          (details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'audio')))))
  })
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const choice = selected
    selected = undefined
    if (!choice || choice.expires < Date.now() || !request.frame ||
        request.frame !== mainWindow?.webContents.mainFrame || !isStudioUrl(request.frame.url)) return callback({})
    callback({ video: choice.source, audio: request.audioRequested ? 'loopback' : undefined })
  })
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
  void capture.stop().catch(() => undefined)
  void presentation.cleanup()
})
