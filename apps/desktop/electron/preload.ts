import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, ObsSnapshot } from '../shared/contracts'

const api: AppApi = {
  app: {
    getStatus: () => ipcRenderer.invoke('app:status'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    openRecordingsFolder: () => ipcRenderer.invoke('app:openRecordingsFolder')
  },
  obs: {
    connect: (options) => ipcRenderer.invoke('obs:connect', options),
    disconnect: () => ipcRenderer.invoke('obs:disconnect'),
    snapshot: () => ipcRenderer.invoke('obs:snapshot'),
    switchScene: (sceneName) => ipcRenderer.invoke('obs:switchScene', sceneName),
    setMute: (inputName, muted) => ipcRenderer.invoke('obs:setMute', { inputName, muted }),
    addInput: (input) => ipcRenderer.invoke('obs:addInput', input),
    startRecord: () => ipcRenderer.invoke('obs:startRecord'),
    stopRecord: () => ipcRenderer.invoke('obs:stopRecord'),
    configureDestination: (destination) => ipcRenderer.invoke('obs:configureDestination', destination),
    startStream: () => ipcRenderer.invoke('obs:startStream'),
    stopStream: () => ipcRenderer.invoke('obs:stopStream'),
    onState: (callback) => {
      const listener = (_: Electron.IpcRendererEvent, state: ObsSnapshot) => callback(state)
      ipcRenderer.on('obs:state', listener)
      return () => ipcRenderer.removeListener('obs:state', listener)
    }
  },
  presentation: {
    import: () => ipcRenderer.invoke('presentation:import'),
    read: (path) => ipcRenderer.invoke('presentation:read', path),
    current: () => ipcRenderer.invoke('presentation:current'),
    openPresenter: () => ipcRenderer.invoke('presentation:openPresenter')
  },
  meeting: {
    create: () => ipcRenderer.invoke('meeting:create'),
    open: (url) => ipcRenderer.invoke('meeting:open', url)
  }
}

contextBridge.exposeInMainWorld('vale', api)
