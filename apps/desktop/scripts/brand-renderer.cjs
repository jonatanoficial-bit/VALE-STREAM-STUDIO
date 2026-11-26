const { app, BrowserWindow } = require('electron')
app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 640, height: 640, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  void window.loadURL('about:blank')
})
app.on('window-all-closed', () => app.quit())
