import { useAppStore, type SessionInfo } from '@/stores/app'

export function useSession() {
  const store = useAppStore()

  async function createNewSession(): Promise<void> {
    const cwd = await window.api.app.getCwd()
    const result = await window.api.pty.spawn(cwd)

    const session: SessionInfo = {
      ptyId: result.id,
      label: `New thread`,
      status: 'running'
    }

    store.addSession(session)
  }

  async function resumeSession(copilotSessionId: string): Promise<void> {
    const result = await window.api.pty.resume(copilotSessionId)

    const shortId = copilotSessionId.slice(0, 8)
    const session: SessionInfo = {
      ptyId: result.id,
      copilotSessionId,
      label: `Session ${shortId}…`,
      status: 'running'
    }

    store.addSession(session)
  }

  function killSession(ptyId: string): void {
    window.api.pty.kill(ptyId)
    store.removeSession(ptyId)
  }

  async function loadCopilotSessions(): Promise<CopilotSession[]> {
    return window.api.sessions.list()
  }

  return {
    createNewSession,
    resumeSession,
    killSession,
    loadCopilotSessions
  }
}
