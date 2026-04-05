<script setup lang="ts">
import { useDictation } from '@/composables/useDictation'

const { status, lastError, toggleDictation } = useDictation()
</script>

<template>
  <button
    class="dictation-btn"
    :class="status"
    @click="toggleDictation"
    :title="lastError || `Dictation: ${status}`"
  >
    <svg
      v-if="status !== 'processing'"
      width="16" height="16" viewBox="0 0 16 16" fill="none"
    >
      <path
        d="M8 1C6.9 1 6 1.9 6 3V8C6 9.1 6.9 10 8 10C9.1 10 10 9.1 10 8V3C10 1.9 9.1 1 8 1Z"
        fill="currentColor"
      />
      <path
        d="M12 8C12 10.21 10.21 12 8 12C5.79 12 4 10.21 4 8H3C3 10.72 5.02 12.93 7.5 13.23V15H8.5V13.23C10.98 12.93 13 10.72 13 8H12Z"
        fill="currentColor"
      />
    </svg>
    <span v-else class="processing-dots">
      <span>•</span><span>•</span><span>•</span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.dictation-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.recording {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.15);
    animation: pulse 1.5s infinite;
  }

  &.processing {
    color: var(--accent);
  }

  &.error {
    color: var(--danger);
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

.processing-dots {
  display: flex;
  gap: 2px;
  font-size: 14px;

  span {
    animation: dotBounce 1.2s infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes dotBounce {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}
</style>
