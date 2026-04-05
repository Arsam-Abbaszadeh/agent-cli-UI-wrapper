<script setup lang="ts">
import { provide, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useSession } from '@/composables/useSession'
import { useOutputBuffer } from '@/composables/useOutputBuffer'
import Sidebar from '@/components/Sidebar.vue'
import TerminalView from '@/components/TerminalView.vue'
import AppView from '@/components/AppView.vue'
import InputBar from '@/components/InputBar.vue'
import ViewToggle from '@/components/ViewToggle.vue'

const store = useAppStore()
const { createNewSession } = useSession()
const outputBuffer = useOutputBuffer()

// Provide output buffer so InputBar can track sent messages
provide('outputBuffer', outputBuffer)

// Wire PTY data to the output buffer when active session changes
let cleanupBuffer: (() => void) | null = null

watch(() => store.activeSession?.ptyId, (newId, oldId) => {
  cleanupBuffer?.()
  cleanupBuffer = null
  outputBuffer.clear()

  if (newId) {
    cleanupBuffer = window.api.pty.onData(newId, (data) => {
      outputBuffer.appendData(data)
    })
  }
}, { immediate: true })
</script>

<template>
  <div class="app-layout">
    <div class="titlebar titlebar-drag">
      <span class="titlebar-title">Agent CLI</span>
      <div class="titlebar-controls titlebar-no-drag" v-if="store.activeSession">
        <ViewToggle />
      </div>
    </div>

    <div class="app-body">
      <Sidebar />

      <div class="main-panel">
        <template v-if="store.activeSession">
          <!-- Both views mounted, one hidden — xterm.js keeps state -->
          <TerminalView
            v-show="store.viewMode === 'terminal'"
            :session-id="store.activeSession.ptyId"
            class="terminal-area"
          />
          <AppView
            v-show="store.viewMode === 'app'"
            :blocks="outputBuffer.blocks.value"
            class="terminal-area"
          />
          <InputBar />
        </template>

        <div v-else class="empty-state">
          <div class="empty-icon">⌘</div>
          <h2>Agent CLI</h2>
          <p>Start a new thread or resume a previous session</p>
          <button class="new-thread-btn" @click="createNewSession">
            + New thread
          </button>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span class="status-item" v-if="store.activeSession">
        {{ store.activeSession.status === 'running' ? '●' : '○' }}
        {{ store.activeSession.label }}
      </span>
      <span class="status-item status-mode">
        {{ store.inputMode === 'input' ? '📝 Input' : '⌨️ Terminal' }}
        <span class="status-hint">Esc to toggle</span>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.titlebar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;

  &-title {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  &-controls {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.terminal-area {
  flex: 1;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);

  h2 {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    font-size: 14px;
  }
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.new-thread-btn {
  margin-top: 8px;
  padding: 10px 24px;
  background: var(--accent);
  color: white;
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s;

  &:hover {
    background: var(--accent-hover);
  }
}

.status-bar {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.status-mode {
  margin-left: auto;
}

.status-hint {
  color: var(--text-muted);
  opacity: 0.6;
  margin-left: 6px;
}
</style>
