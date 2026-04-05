import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  pty: {
    spawn: (cwd: string, args?: string[]) =>
      ipcRenderer.invoke('pty:spawn', cwd, args),

    resume: (sessionId: string) =>
      ipcRenderer.invoke('pty:resume', sessionId),

    write: (sessionId: string, data: string) =>
      ipcRenderer.send('pty:write', sessionId, data),

    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', sessionId, cols, rows),

    kill: (sessionId: string) =>
      ipcRenderer.send('pty:kill', sessionId),

    onData: (sessionId: string, cb: (data: string) => void) => {
      const channel = `pty:data:${sessionId}`
      const handler = (_e: Electron.IpcRendererEvent, data: string) => cb(data)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    },

    onExit: (sessionId: string, cb: (code: number) => void) => {
      const channel = `pty:exit:${sessionId}`
      const handler = (_e: Electron.IpcRendererEvent, code: number) => cb(code)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    }
  },

  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    fork: (sessionId: string) => ipcRenderer.invoke('sessions:fork', sessionId)
  },

  dictation: {
    start: () => ipcRenderer.invoke('dictation:start'),
    stop: () => ipcRenderer.send('dictation:stop'),
    onResult: (cb: (result: any) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, result: any) => cb(result)
      ipcRenderer.on('dictation:result', handler)
      return () => ipcRenderer.removeListener('dictation:result', handler)
    },
    onStatus: (cb: (status: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, status: string) => cb(status)
      ipcRenderer.on('dictation:status', handler)
      return () => ipcRenderer.removeListener('dictation:status', handler)
    },
    onError: (cb: (error: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, error: string) => cb(error)
      ipcRenderer.on('dictation:error', handler)
      return () => ipcRenderer.removeListener('dictation:error', handler)
    },
    listProviders: () => ipcRenderer.invoke('dictation:providers'),
    setProvider: (name: string) => ipcRenderer.invoke('dictation:setProvider', name)
  },

  model: {
    set: (sessionId: string, modelName: string) =>
      ipcRenderer.invoke('model:set', sessionId, modelName)
  },

  app: {
    getCwd: () => ipcRenderer.invoke('app:getCwd')
  }
})
