import { ipcMain } from 'electron'
import * as os from 'os'
import { PtyManager } from './pty-manager'
import { SessionManager } from './session-manager'

export function registerIpcHandlers(
  ptyManager: PtyManager,
  sessionManager: SessionManager
): void {
  // --- PTY ---
  ipcMain.handle('pty:spawn', (_e, cwd: string, args?: string[]) => {
    const session = ptyManager.spawn(cwd, args)
    return { id: session.id }
  })

  ipcMain.handle('pty:resume', (_e, copilotSessionId: string) => {
    const session = ptyManager.resume(copilotSessionId)
    return { id: session.id }
  })

  ipcMain.on('pty:write', (_e, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data)
  })

  ipcMain.on('pty:resize', (_e, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows)
  })

  ipcMain.on('pty:kill', (_e, sessionId: string) => {
    ptyManager.kill(sessionId)
  })

  // --- Sessions ---
  ipcMain.handle('sessions:list', () => sessionManager.listSessions())

  ipcMain.handle('sessions:fork', (_e, sessionId: string) =>
    sessionManager.forkSession(sessionId)
  )

  // --- Model ---
  ipcMain.handle('model:set', (_e, sessionId: string, modelName: string) => {
    ptyManager.write(sessionId, `/model ${modelName}\n`)
  })

  // --- App ---
  ipcMain.handle('app:getCwd', () => {
    return process.cwd() || os.homedir()
  })
}
