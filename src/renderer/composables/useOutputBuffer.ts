import { ref, computed } from 'vue'
import { parseBlocks, type RenderedBlock } from '@/lib/block-parser'

/**
 * Composable that buffers PTY output data and exposes it as both raw text
 * and parsed RenderedBlock[].
 *
 * Usage: create one per session. Feed it PTY data. Consume `blocks` in AppView.
 */
export function useOutputBuffer() {
  const rawChunks = ref<string[]>([])
  const sentMessages = ref<string[]>([])

  const rawText = computed(() => rawChunks.value.join(''))

  const blocks = computed<RenderedBlock[]>(() => {
    if (rawChunks.value.length === 0) return []
    return parseBlocks(rawText.value, sentMessages.value)
  })

  function appendData(data: string): void {
    rawChunks.value.push(data)
  }

  function trackSentMessage(msg: string): void {
    sentMessages.value.push(msg)
  }

  function clear(): void {
    rawChunks.value = []
    sentMessages.value = []
  }

  return {
    rawText,
    blocks,
    appendData,
    trackSentMessage,
    clear
  }
}
