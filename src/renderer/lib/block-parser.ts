import { AnsiUp } from 'ansi_up'

// ── Types ──

export type BlockType =
  | 'assistant'
  | 'user'
  | 'code'
  | 'tool-call'
  | 'tool-output'
  | 'thinking'
  | 'divider'
  | 'system'
  | 'raw'

export interface RenderedBlock {
  id: string
  type: BlockType
  html: string
  rawText: string
  timestamp: number
  language?: string
  collapsed?: boolean
}

// ── ANSI conversion ──

const ansiUp = new AnsiUp()
ansiUp.use_classes = false

export function ansiToHtml(raw: string): string {
  return ansiUp.ansi_to_html(raw)
}

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[.*?[A-Za-z]/g
export function stripAnsi(raw: string): string {
  return raw.replace(ANSI_RE, '')
}

// ── Heuristic patterns ──

const CODE_FENCE_OPEN = /^```(\w*)$/
const CODE_FENCE_CLOSE = /^```$/
const TOOL_CALL_RE = /^[⚡📄🔍✏️🗑️💻🔧⬆️]+ ?(Running|Reading|Searching|Writing|Deleting|Executing|Calling|Editing|Applying)/
const DIVIDER_RE = /^[─═━▔▁\-]{4,}$/
const THINKING_RE = /^> /
const SYSTEM_RE = /^\[(Session|Error|Warning|Info)/i

let blockIdCounter = 0
function nextId(): string {
  return `blk-${++blockIdCounter}`
}

// ── Parser ──

export function parseBlocks(rawText: string, sentMessages: string[] = []): RenderedBlock[] {
  const lines = rawText.split('\n')
  const blocks: RenderedBlock[] = []
  const now = Date.now()

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const stripped = stripAnsi(line).trim()

    if (stripped === '') {
      i++
      continue
    }

    // ── Code fence ──
    const fenceMatch = stripped.match(CODE_FENCE_OPEN)
    if (fenceMatch && !CODE_FENCE_CLOSE.test(stripped)) {
      const language = fenceMatch[1] || undefined
      const codeLines: string[] = []
      i++
      while (i < lines.length) {
        const cl = stripAnsi(lines[i]).trim()
        if (CODE_FENCE_CLOSE.test(cl)) {
          i++
          break
        }
        codeLines.push(lines[i])
        i++
      }
      const rawCode = codeLines.join('\n')
      blocks.push({
        id: nextId(),
        type: 'code',
        html: `<pre><code>${escapeHtml(stripAnsi(rawCode))}</code></pre>`,
        rawText: stripAnsi(rawCode),
        timestamp: now,
        language
      })
      continue
    }

    // ── Divider ──
    if (DIVIDER_RE.test(stripped)) {
      blocks.push({
        id: nextId(),
        type: 'divider',
        html: '<hr />',
        rawText: stripped,
        timestamp: now
      })
      i++
      continue
    }

    // ── Tool call ──
    if (TOOL_CALL_RE.test(stripped)) {
      const toolLines: string[] = [line]
      i++
      while (i < lines.length) {
        const nextStripped = stripAnsi(lines[i]).trim()
        if (
          nextStripped === '' ||
          TOOL_CALL_RE.test(nextStripped) ||
          DIVIDER_RE.test(nextStripped) ||
          CODE_FENCE_OPEN.test(nextStripped)
        ) break
        toolLines.push(lines[i])
        i++
      }
      const raw = toolLines.join('\n')
      blocks.push({
        id: nextId(),
        type: 'tool-call',
        html: ansiToHtml(raw),
        rawText: stripAnsi(raw),
        timestamp: now,
        collapsed: true
      })
      continue
    }

    // ── Thinking ──
    if (THINKING_RE.test(stripped)) {
      const thinkLines: string[] = []
      while (i < lines.length && THINKING_RE.test(stripAnsi(lines[i]).trim())) {
        thinkLines.push(lines[i].replace(/^(\s*\x1b\[[0-9;]*m)*> ?/, ''))
        i++
      }
      const raw = thinkLines.join('\n')
      blocks.push({
        id: nextId(),
        type: 'thinking',
        html: ansiToHtml(raw),
        rawText: stripAnsi(raw),
        timestamp: now,
        collapsed: true
      })
      continue
    }

    // ── System message ──
    if (SYSTEM_RE.test(stripped)) {
      blocks.push({
        id: nextId(),
        type: 'system',
        html: ansiToHtml(line),
        rawText: stripped,
        timestamp: now
      })
      i++
      continue
    }

    // ── User echo ──
    if (sentMessages.some(msg => stripped.includes(msg.trim()))) {
      blocks.push({
        id: nextId(),
        type: 'user',
        html: ansiToHtml(line),
        rawText: stripped,
        timestamp: now
      })
      i++
      continue
    }

    // ── Default: assistant text ──
    const textLines: string[] = [line]
    i++
    while (i < lines.length) {
      const nextStripped = stripAnsi(lines[i]).trim()
      if (
        nextStripped === '' ||
        CODE_FENCE_OPEN.test(nextStripped) ||
        TOOL_CALL_RE.test(nextStripped) ||
        DIVIDER_RE.test(nextStripped) ||
        THINKING_RE.test(nextStripped) ||
        SYSTEM_RE.test(nextStripped)
      ) break
      textLines.push(lines[i])
      i++
    }
    const raw = textLines.join('\n')
    blocks.push({
      id: nextId(),
      type: 'assistant',
      html: ansiToHtml(raw),
      rawText: stripAnsi(raw),
      timestamp: now
    })
  }

  return blocks
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
