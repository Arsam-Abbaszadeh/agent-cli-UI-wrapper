<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import type { RenderedBlock } from '@/lib/block-parser'
import AppViewBlock from './AppViewBlock.vue'

const props = defineProps<{
  blocks: RenderedBlock[]
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

// Auto-scroll to bottom when new blocks arrive
watch(() => props.blocks.length, async () => {
  if (!autoScroll.value) return
  await nextTick()
  scrollToBottom()
})

function scrollToBottom(): void {
  const el = scrollContainer.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

function handleScroll(): void {
  const el = scrollContainer.value
  if (!el) return
  // Disable auto-scroll if user scrolls up
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  autoScroll.value = atBottom
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div
    ref="scrollContainer"
    class="app-view"
    @scroll="handleScroll"
  >
    <div class="app-view-inner">
      <div v-if="blocks.length === 0" class="app-view-empty">
        <p>Waiting for output...</p>
      </div>
      <AppViewBlock
        v-for="block in blocks"
        :key="block.id"
        :block="block"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-view {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  padding: 16px 20px;
}

.app-view-inner {
  max-width: 800px;
  margin: 0 auto;
}

.app-view-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-style: italic;
}
</style>
