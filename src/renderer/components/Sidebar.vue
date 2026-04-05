<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSession } from '@/composables/useSession'

const store = useAppStore()
const { createNewSession, resumeSession, loadCopilotSessions } = useSession()
const copilotSessions = ref<CopilotSession[]>([])
const loading = ref(false)
const showSessionList = ref(false)

async function handleNewThread(): Promise<void> {
  await createNewSession()
}

async function handleResume(copilotSessionId: string): Promise<void> {
  await resumeSession(copilotSessionId)
  showSessionList.value = false
}

async function refreshSessions(): Promise<void> {
  loading.value = true
  try {
    copilotSessions.value = await loadCopilotSessions()
  } finally {
    loading.value = false
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

onMounted(() => {
  refreshSessions()
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <button class="new-thread" @click="handleNewThread">
        <span class="icon">+</span> New thread
      </button>
    </div>

    <!-- Active sessions (running in the app) -->
    <div class="sidebar-section" v-if="store.sessions.length > 0">
      <div class="section-label">Active</div>
      <div
        v-for="session in store.sessions"
        :key="session.ptyId"
        class="session-item"
        :class="{ active: session.ptyId === store.activeSessionId }"
        @click="store.setActiveSession(session.ptyId)"
      >
        <span class="session-status" :class="session.status">●</span>
        <span class="session-label">{{ session.label }}</span>
      </div>
    </div>

    <!-- Resume from Copilot sessions -->
    <div class="sidebar-section">
      <div class="section-label" @click="showSessionList = !showSessionList" style="cursor: pointer">
        Sessions
        <span class="toggle">{{ showSessionList ? '▾' : '▸' }}</span>
        <button class="refresh-btn" @click.stop="refreshSessions" title="Refresh">↻</button>
      </div>

      <template v-if="showSessionList">
        <div v-if="loading" class="session-item loading">Loading...</div>
        <div
          v-else-if="copilotSessions.length === 0"
          class="session-item empty"
        >
          No sessions found
        </div>
        <div
          v-for="cs in copilotSessions"
          :key="cs.id"
          class="session-item resumable"
          @click="handleResume(cs.id)"
          :title="cs.id"
        >
          <span class="session-icon">↩</span>
          <span class="session-label">{{ cs.id.slice(0, 8) }}…</span>
          <span class="session-date">{{ formatDate(cs.lastModified) }}</span>
        </div>
      </template>
    </div>

    <div class="sidebar-footer">
      <span class="version">v0.1.0</span>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-header {
    padding: 12px;
    padding-top: 8px;
  }

  &-section {
    padding: 4px 0;
  }

  &-footer {
    margin-top: auto;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
  }
}

.new-thread {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  .icon {
    font-size: 16px;
    color: var(--accent);
  }
}

.section-label {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle {
  font-size: 10px;
}

.refresh-btn {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: var(--radius-sm);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.session-item {
  padding: 6px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.1s;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.loading,
  &.empty {
    cursor: default;
    color: var(--text-muted);
    font-style: italic;
  }

  &.resumable:hover .session-icon {
    color: var(--accent);
  }
}

.session-status {
  font-size: 8px;

  &.running { color: var(--success); }
  &.exited  { color: var(--text-muted); }
}

.session-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-icon {
  font-size: 12px;
  color: var(--text-muted);
}

.session-date {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.version {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
