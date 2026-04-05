import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

export interface CopilotSession {
  id: string
  lastModified: string
}

export class SessionManager {
  private sessionDir: string

  constructor() {
    this.sessionDir = path.join(os.homedir(), '.copilot', 'session-state')
  }

  async listSessions(): Promise<CopilotSession[]> {
    try {
      const entries = await fs.readdir(this.sessionDir, { withFileTypes: true })
      const sessions: CopilotSession[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        // Copilot session directories are UUIDs
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name)) {
          continue
        }

        try {
          const stat = await fs.stat(path.join(this.sessionDir, entry.name))
          sessions.push({
            id: entry.name,
            lastModified: stat.mtime.toISOString()
          })
        } catch {
          // Skip sessions we can't stat
        }
      }

      // Sort by most recent first
      sessions.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      return sessions
    } catch {
      // Directory may not exist if copilot hasn't been used
      return []
    }
  }

  async forkSession(sessionId: string): Promise<string> {
    const { randomUUID } = await import('crypto')
    const newId = randomUUID()
    const src = path.join(this.sessionDir, sessionId)
    const dest = path.join(this.sessionDir, newId)

    await fs.cp(src, dest, { recursive: true })
    return newId
  }
}
