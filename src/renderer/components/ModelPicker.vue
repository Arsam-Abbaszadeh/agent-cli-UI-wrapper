<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const isOpen = ref(false)
const pickerRef = ref<HTMLElement | null>(null)

const models = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.1', label: 'GPT-5.1' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' }
]

const currentLabel = computed(() => {
  const m = models.find(m => m.id === store.selectedModel)
  return m?.label ?? store.selectedModel
})

async function selectModel(modelId: string): Promise<void> {
  if (!store.activeSession) return
  await window.api.model.set(store.activeSession.ptyId, modelId)
  store.setModel(modelId)
  isOpen.value = false
}

function toggle(): void {
  isOpen.value = !isOpen.value
}

function handleClickOutside(e: MouseEvent): void {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="model-picker" ref="pickerRef">
    <button class="model-trigger" @click="toggle" :title="`Model: ${currentLabel}`">
      {{ currentLabel }}
      <span class="chevron">▾</span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="model-dropdown" @click.stop>
        <div class="dropdown-header">Select Model</div>
        <button
          v-for="model in models"
          :key="model.id"
          class="model-option"
          :class="{ selected: model.id === store.selectedModel }"
          @click="selectModel(model.id)"
        >
          <span class="check">{{ model.id === store.selectedModel ? '✓' : '' }}</span>
          {{ model.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.model-picker {
  position: relative;
}

.model-trigger {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .chevron {
    font-size: 10px;
    opacity: 0.6;
  }
}

.model-dropdown {
  position: fixed;
  bottom: 80px;
  left: 240px;
  width: 220px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  padding: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-header {
  padding: 8px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.model-option {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: background 0.1s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.selected {
    color: var(--accent);
  }

  .check {
    width: 16px;
    font-size: 12px;
    text-align: center;
    color: var(--accent);
  }
}
</style>
