import { BrowserWindow } from 'electron'
import * as nodePty from 'node-pty'
import * as os from 'os'
import { randomUUID } from 'crypto'

export interface PtySession {
  id: string
  copilotSessionId?: string
  pty: nodePty.IPty
  cwd: string
  status: 'running' | 'exited'
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  spawn(cwd: string, args: string[] = []): PtySession {
    const id = randomUUID()

    // Use a login shell to get full environment (PATH, etc.)
    const isWin = process.platform === 'win32'
    const shell = isWin ? 'cmd.exe' : (process.env.SHELL || '/bin/zsh')
    const copilotCmd = `copilot ${args.join(' ')}`.trim()
    const shellArgs = isWin ? ['/c', copilotCmd] : ['-lc', copilotCmd]

    const pty = nodePty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      } as Record<string, string>
    })

    const session: PtySession = { id, pty, cwd, status: 'running' }

    pty.onData((data: string) => {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(`pty:data:${id}`, data)
      }
    })

    pty.onExit(({ exitCode }) => {
      session.status = 'exited'
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(`pty:exit:${id}`, exitCode)
      }
    })

    this.sessions.set(id, session)
    return session
  }

  resume(copilotSessionId: string): PtySession {
    const session = this.spawn(os.homedir(), ['--resume', copilotSessionId])
    session.copilotSessionId = copilotSessionId
    return session
  }

  continueLatest(): PtySession {
    return this.spawn(os.homedir(), ['--continue'])
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (session && session.status === 'running') {
      session.pty.write(data)
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (session && session.status === 'running') {
      session.pty.resize(cols, rows)
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pty.kill()
      session.status = 'exited'
      this.sessions.delete(sessionId)
    }
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id)
    }
  }

  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId)
  }
}
