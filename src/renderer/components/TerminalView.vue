<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTerminal } from '@/composables/useTerminal'
import { useAppStore } from '@/stores/app'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{
  sessionId: string
}>()

const store = useAppStore()
const containerRef = ref<HTMLElement | null>(null)
const { attachSession, detachSession, focus, fit } = useTerminal(containerRef)

let cleanupExit: (() => void) | null = null

function wireSession(id: string): void {
  attachSession(id)
  cleanupExit = window.api.pty.onExit(id, () => {
    store.markSessionExited(id)
  })
}

function unwireSession(): void {
  detachSession()
  cleanupExit?.()
  cleanupExit = null
}

watch(() => props.sessionId, (newId, oldId) => {
  if (oldId) unwireSession()
  if (newId) wireSession(newId)
}, { immediate: true })

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (store.inputMode === 'input') {
      store.setInputMode('terminal')
      focus()
    } else {
      store.setInputMode('input')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.sessionId) wireSession(props.sessionId)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  unwireSession()
})
</script>

<template>
  <div
    ref="containerRef"
    class="terminal-container"
    :class="{ 'terminal-focused': store.inputMode === 'terminal' }"
    @click="() => { store.setInputMode('terminal'); focus() }"
  />
</template>

<style scoped lang="scss">
.terminal-container {
  width: 100%;
  height: 100%;
  padding: 8px;
  background: var(--bg-primary);
  border: 2px solid transparent;
  transition: border-color 0.15s;

  &.terminal-focused {
    border-color: var(--accent);
  }

  :deep(.xterm) {
    height: 100%;
  }

  :deep(.xterm-viewport) {
    overflow-y: auto !important;
  }
}
</style>
