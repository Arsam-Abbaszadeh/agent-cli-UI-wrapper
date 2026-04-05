/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface DictationResult {
  text: string
  isFinal: boolean
  confidence?: number
}

interface CopilotSession {
  id: string
  lastModified: string
}

interface PtySpawnResult {
  id: string
}

interface DictationProviderInfo {
  name: string
  isLocal: boolean
  available: boolean
}

interface ElectronApi {
  pty: {
    spawn: (cwd: string, args?: string[]) => Promise<PtySpawnResult>
    resume: (sessionId: string) => Promise<PtySpawnResult>
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    kill: (sessionId: string) => void
    onData: (sessionId: string, cb: (data: string) => void) => () => void
    onExit: (sessionId: string, cb: (code: number) => void) => () => void
  }
  sessions: {
    list: () => Promise<CopilotSession[]>
    fork: (sessionId: string) => Promise<string>
  }
  dictation: {
    start: () => Promise<void>
    stop: () => void
    onResult: (cb: (result: DictationResult) => void) => () => void
    onStatus: (cb: (status: string) => void) => () => void
    onError: (cb: (error: string) => void) => () => void
    listProviders: () => Promise<DictationProviderInfo[]>
    setProvider: (name: string) => Promise<void>
  }
  model: {
    set: (sessionId: string, modelName: string) => Promise<void>
  }
  app: {
    getCwd: () => Promise<string>
  }
}

interface Window {
  api: ElectronApi
}
