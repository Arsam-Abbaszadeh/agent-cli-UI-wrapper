import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'

export function useTerminal(containerRef: Ref<HTMLElement | null>) {
  const terminal = new Terminal({
    theme: {
      background: '#1a1a2e',
      foreground: '#e5e7eb',
      cursor: '#e5e7eb',
      cursorAccent: '#1a1a2e',
      selectionBackground: '#3b82f640',
      black: '#1a1a2e',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#e5e7eb',
      brightBlack: '#6b7280',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#f9fafb'
    },
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace",
    fontSize: 14,
    lineHeight: 1.3,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 10000,
    allowProposedApi: true
  })

  const fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  let cleanupDataListener: (() => void) | null = null
  let cleanupExitListener: (() => void) | null = null
  const resizeObserver = ref<ResizeObserver | null>(null)

  function mount(): void {
    if (!containerRef.value) return
    terminal.open(containerRef.value)

    // Try WebGL for performance, fallback gracefully
    try {
      terminal.loadAddon(new WebglAddon())
    } catch {
      // WebGL not available, canvas renderer is fine
    }

    fitAddon.fit()

    // Auto-resize when container size changes
    resizeObserver.value = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.value.observe(containerRef.value)
  }

  function attachSession(sessionId: string): void {
    // Clean up previous listeners
    detachSession()

    // Output from PTY → terminal
    cleanupDataListener = window.api.pty.onData(sessionId, (data) => {
      terminal.write(data)
    })

    // Direct keyboard input from terminal → PTY
    const disposable = terminal.onData((data) => {
      window.api.pty.write(sessionId, data)
    })

    // Exit handler
    cleanupExitListener = window.api.pty.onExit(sessionId, (_code) => {
      terminal.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
    })

    // Resize handler
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.api.pty.resize(sessionId, cols, rows)
    })

    // Send initial size
    fitAddon.fit()
    const { cols, rows } = terminal
    window.api.pty.resize(sessionId, cols, rows)

    // Store disposables for cleanup
    const origCleanup = cleanupDataListener
    cleanupDataListener = () => {
      origCleanup?.()
      disposable.dispose()
      resizeDisposable.dispose()
    }
  }

  function detachSession(): void {
    cleanupDataListener?.()
    cleanupExitListener?.()
    cleanupDataListener = null
    cleanupExitListener = null
  }

  function clear(): void {
    terminal.clear()
  }

  function focus(): void {
    terminal.focus()
  }

  function fit(): void {
    fitAddon.fit()
  }

  onMounted(() => {
    mount()
  })

  onBeforeUnmount(() => {
    detachSession()
    resizeObserver.value?.disconnect()
    terminal.dispose()
  })

  return {
    terminal,
    attachSession,
    detachSession,
    clear,
    focus,
    fit
  }
}
