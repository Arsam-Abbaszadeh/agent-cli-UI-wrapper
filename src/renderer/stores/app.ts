import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface SessionInfo {
  /** Our internal PTY session ID */
  ptyId: string
  /** Copilot session ID (from filesystem), if resuming */
  copilotSessionId?: string
  /** Display label */
  label: string
  status: 'running' | 'exited'
}

export const useAppStore = defineStore('app', () => {
  const sessions = ref<SessionInfo[]>([])
  const activeSessionId = ref<string | null>(null)
  const selectedModel = ref<string>('claude-sonnet-4')
  const inputMode = ref<'input' | 'terminal'>('input')

  const activeSession = computed(() =>
    sessions.value.find(s => s.ptyId === activeSessionId.value) ?? null
  )

  function addSession(session: SessionInfo): void {
    sessions.value.push(session)
    activeSessionId.value = session.ptyId
  }

  function removeSession(ptyId: string): void {
    sessions.value = sessions.value.filter(s => s.ptyId !== ptyId)
    if (activeSessionId.value === ptyId) {
      activeSessionId.value = sessions.value[0]?.ptyId ?? null
    }
  }

  function setActiveSession(ptyId: string): void {
    activeSessionId.value = ptyId
  }

  function markSessionExited(ptyId: string): void {
    const s = sessions.value.find(s => s.ptyId === ptyId)
    if (s) s.status = 'exited'
  }

  function setModel(model: string): void {
    selectedModel.value = model
  }

  function toggleInputMode(): void {
    inputMode.value = inputMode.value === 'input' ? 'terminal' : 'input'
  }

  function setInputMode(mode: 'input' | 'terminal'): void {
    inputMode.value = mode
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    selectedModel,
    inputMode,
    addSession,
    removeSession,
    setActiveSession,
    markSessionExited,
    setModel,
    toggleInputMode,
    setInputMode
  }
})
