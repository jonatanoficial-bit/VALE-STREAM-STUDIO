export type ObsConnectionState = {
  connected: boolean
  host: string
  port: number
  obsVersion?: string
  websocketVersion?: string
  error?: string
}

export type OutputState = {
  active: boolean
  timecode?: string
  outputPath?: string
  error?: string
}

export type ObsSnapshot = {
  connection: ObsConnectionState
  scenes: string[]
  currentScene?: string
  inputs: Array<{ name: string; kind: string; muted?: boolean }>
  inputKinds: string[]
  recording: OutputState
  streaming: OutputState
}

export type PresentationFile = {
  path: string
  filename: string
  kind: 'pdf' | 'ppt' | 'pptx'
  converted: boolean
  notice?: string
}

export type Meeting = {
  roomId: string
  guestUrl: string
  directorUrl: string
  invitation: string
  provider: 'VDO.Ninja'
  limitations: string
}

export type Destination = {
  platform: 'youtube' | 'facebook' | 'custom'
  server: string
  configured: boolean
}

export type AppApi = {
  app: {
    getStatus: () => Promise<{ platform: string; freeSpaceGb?: number; obsExecutable?: string }>
    openExternal: (url: string) => Promise<void>
    openRecordingsFolder: () => Promise<void>
  }
  obs: {
    connect: (options: { host: string; port: number; password: string }) => Promise<ObsSnapshot>
    disconnect: () => Promise<ObsSnapshot>
    snapshot: () => Promise<ObsSnapshot>
    switchScene: (sceneName: string) => Promise<ObsSnapshot>
    setMute: (inputName: string, muted: boolean) => Promise<ObsSnapshot>
    addInput: (input: { sceneName: string; inputName: string; inputKind: string; settings: Record<string, unknown> }) => Promise<ObsSnapshot>
    startRecord: () => Promise<ObsSnapshot>
    stopRecord: () => Promise<ObsSnapshot>
    configureDestination: (destination: { platform: Destination['platform']; server: string; key: string }) => Promise<Destination>
    startStream: () => Promise<ObsSnapshot>
    stopStream: () => Promise<ObsSnapshot>
    onState: (callback: (state: ObsSnapshot) => void) => () => void
  }
  presentation: {
    import: () => Promise<PresentationFile | null>
    read: (path: string) => Promise<Uint8Array>
    current: () => Promise<PresentationFile | null>
    openPresenter: () => Promise<void>
  }
  meeting: {
    create: () => Promise<Meeting>
    open: (url: string) => Promise<void>
  }
}
