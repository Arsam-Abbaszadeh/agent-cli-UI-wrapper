<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useDictation } from '@/composables/useDictation'
import ModelPicker from './ModelPicker.vue'
import DictationButton from './DictationButton.vue'

const store = useAppStore()
const { interimText } = useDictation()
const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSend = computed(() =>
  inputText.value.trim().length > 0 && store.activeSession?.status === 'running'
)

function sendMessage(): void {
  if (!canSend.value) return

  const session = store.activeSession
  if (!session) return

  const text = inputText.value
  inputText.value = ''

  // Write to PTY stdin (the text + newline, like pressing Enter in a terminal)
  window.api.pty.write(session.ptyId, text + '\n')

  // Reset textarea height
  nextTick(() => autoResize())

  // Ensure we're in input mode
  store.setInputMode('input')
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function autoResize(): void {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function handleInput(): void {
  autoResize()
}

function focusInput(): void {
  store.setInputMode('input')
  textareaRef.value?.focus()
}

// Re-focus input when switching back to input mode
import { watch } from 'vue'
watch(() => store.inputMode, (mode) => {
  if (mode === 'input') {
    nextTick(() => textareaRef.value?.focus())
  }
})

// When dictation produces a final result, insert it into the input
window.api.dictation.onResult((result) => {
  if (result.isFinal && result.text) {
    inputText.value += (inputText.value ? ' ' : '') + result.text
    nextTick(() => autoResize())
  }
})
</script>

<template>
  <div class="input-bar" @click="focusInput">
    <div class="input-controls-left">
      <ModelPicker />
    </div>

    <div class="input-field-wrapper">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="input-field"
        :placeholder="interimText || (store.activeSession?.status === 'running'
          ? 'Send a message to Copilot CLI...'
          : 'Session ended')"
        :disabled="store.activeSession?.status !== 'running'"
        rows="1"
        @keydown="handleKeydown"
        @input="handleInput"
      />
    </div>

    <div class="input-controls-right">
      <DictationButton />
      <button
        class="send-btn"
        :disabled="!canSend"
        @click="sendMessage"
        title="Send (Enter)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 13V9L7 8L3 7V3L14 8L3 13Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.input-controls-left,
.input-controls-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.input-controls-right {
  gap: 6px;
}

.input-field-wrapper {
  flex: 1;
  min-width: 0;
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  border-radius: var(--radius-lg);
  min-height: 38px;
  max-height: 200px;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.send-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--accent);
  color: white;
  transition: background 0.15s, opacity 0.15s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: var(--accent-hover);
  }
}
</style>
