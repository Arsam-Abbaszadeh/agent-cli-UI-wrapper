<script setup lang="ts">
import { ref } from 'vue'
import type { RenderedBlock } from '@/lib/block-parser'

const props = defineProps<{
  block: RenderedBlock
}>()

const isCollapsed = ref(props.block.collapsed ?? false)

function toggleCollapse(): void {
  isCollapsed.value = !isCollapsed.value
}

const typeIcons: Record<string, string> = {
  'assistant': '',
  'user': '👤',
  'code': '📋',
  'tool-call': '⚡',
  'tool-output': '📤',
  'thinking': '💭',
  'system': 'ℹ️',
  'raw': ''
}

const typeLabels: Record<string, string> = {
  'tool-call': 'Tool Call',
  'tool-output': 'Tool Output',
  'thinking': 'Thinking',
  'system': 'System'
}
</script>

<template>
  <div class="block" :class="`block--${block.type}`">
    <!-- Divider -->
    <hr v-if="block.type === 'divider'" class="block-divider" />

    <!-- Collapsible blocks (tool-call, thinking) -->
    <template v-else-if="block.collapsed !== undefined">
      <button class="block-header" @click="toggleCollapse">
        <span class="block-icon">{{ typeIcons[block.type] }}</span>
        <span class="block-label">{{ typeLabels[block.type] || block.type }}</span>
        <span class="block-chevron">{{ isCollapsed ? '▸' : '▾' }}</span>
      </button>
      <div v-show="!isCollapsed" class="block-content" v-html="block.html" />
    </template>

    <!-- User message -->
    <div v-else-if="block.type === 'user'" class="block-user">
      <span class="block-icon">{{ typeIcons[block.type] }}</span>
      <div class="block-content" v-html="block.html" />
    </div>

    <!-- Code block -->
    <div v-else-if="block.type === 'code'" class="block-code">
      <div class="code-header" v-if="block.language">
        <span class="code-lang">{{ block.language }}</span>
      </div>
      <div v-html="block.html" />
    </div>

    <!-- Assistant / raw / system -->
    <div v-else class="block-content" v-html="block.html" />
  </div>
</template>

<style scoped lang="scss">
.block {
  padding: 4px 0;
  line-height: 1.6;
  font-size: 14px;
  word-wrap: break-word;

  &--user {
    margin: 12px 0 4px;
  }

  &--assistant {
    white-space: pre-wrap;
  }

  &--system {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
  }
}

.block-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}

.block-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-muted);
  width: 100%;
  text-align: left;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }
}

.block-icon {
  flex-shrink: 0;
}

.block-label {
  font-weight: 500;
}

.block-chevron {
  margin-left: auto;
  font-size: 10px;
}

.block-user {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  margin: 8px 0;

  .block-content {
    flex: 1;
    white-space: pre-wrap;
  }
}

.block-content {
  white-space: pre-wrap;
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 2px 0;
}

.block-code {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 8px 0;

  .code-header {
    padding: 4px 12px;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    background: var(--bg-input);
  }

  .code-lang {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :deep(pre) {
    margin: 0;
    padding: 12px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
  }

  :deep(code) {
    font-family: inherit;
  }
}
</style>
