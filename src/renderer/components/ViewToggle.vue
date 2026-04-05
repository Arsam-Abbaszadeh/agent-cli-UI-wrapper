<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const store = useAppStore()

function toggle(): void {
  store.setViewMode(store.viewMode === 'terminal' ? 'app' : 'terminal')
}
</script>

<template>
  <div class="view-toggle">
    <button
      class="toggle-btn"
      :class="{ active: store.viewMode === 'terminal' }"
      @click="store.setViewMode('terminal')"
      title="Terminal View"
    >
      ⌨️ Terminal
    </button>
    <button
      class="toggle-btn"
      :class="{ active: store.viewMode === 'app' }"
      @click="store.setViewMode('app')"
      title="App View"
    >
      💬 App
    </button>
  </div>
</template>

<style scoped lang="scss">
.view-toggle {
  display: flex;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.toggle-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-muted);
  transition: all 0.15s;
  border-right: 1px solid var(--border);

  &:last-child {
    border-right: none;
  }

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.active {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }
}
</style>
