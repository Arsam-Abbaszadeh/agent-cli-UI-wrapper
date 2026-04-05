import { ref, onMounted, onBeforeUnmount } from 'vue'

export type DictationStatus = 'idle' | 'recording' | 'processing' | 'error'

export function useDictation() {
  const status = ref<DictationStatus>('idle')
  const interimText = ref('')
  const lastError = ref('')

  let cleanupResult: (() => void) | null = null
  let cleanupStatus: (() => void) | null = null
  let cleanupError: (() => void) | null = null

  function setup(): void {
    cleanupResult = window.api.dictation.onResult((result) => {
      if (result.isFinal) {
        interimText.value = ''
      } else {
        interimText.value = result.text
      }
    })

    cleanupStatus = window.api.dictation.onStatus((s: string) => {
      status.value = s as DictationStatus
    })

    cleanupError = window.api.dictation.onError((error: string) => {
      lastError.value = error
      status.value = 'error'
    })
  }

  function teardown(): void {
    cleanupResult?.()
    cleanupStatus?.()
    cleanupError?.()
  }

  async function toggleDictation(): Promise<void> {
    if (status.value === 'recording') {
      window.api.dictation.stop()
      status.value = 'idle'
    } else {
      lastError.value = ''
      await window.api.dictation.start()
    }
  }

  onMounted(setup)
  onBeforeUnmount(teardown)

  return {
    status,
    interimText,
    lastError,
    toggleDictation
  }
}
