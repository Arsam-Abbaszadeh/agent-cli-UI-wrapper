# Agent CLI UI Wrapper

Cross-platform Electron app wrapping GitHub Copilot CLI with:
- PTY-based Copilot CLI spawning via `node-pty`
- Terminal output rendering via `xterm.js` + WebGL addon
- Pluggable dictation providers (local whisper.cpp, external OpenAI-compatible API)
- Session management (discover, resume, fork sessions from `~/.copilot/session-state/`)
- Model picker via `/model` slash command

## Architecture

```
Main Process (Node.js)     Preload (contextBridge)     Renderer (Vue 3)
├── PtyManager             └── window.api.pty.*    ├── xterm.js Terminal
├── SessionManager         └── window.api.sessions├── InputBar
└── DictationManager       └── window.api.dictation└── Sidebar
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/main/index.ts` | App entry, BrowserWindow creation |
| `src/main/pty-manager.ts` | Spawn/resume/write/kill PTYs |
| `src/main/session-manager.ts` | Session discovery from `~/.copilot/session-state/` |
| `src/main/ipc-handlers.ts` | All IPC channel registrations |
| `src/preload/index.ts` | `contextBridge` API surface |
| `src/renderer/components/TerminalView.vue` | xterm.js wrapper |
| `src/renderer/composables/useTerminal.ts` | PTY ↔ xterm.js wiring |

## IPC Channels

**PTY:**
- `pty:spawn` — spawn new session
- `pty:resume` — resume existing session
- `pty:write` — write to PTY stdin
- `pty:resize` — resize PTY (SIGWINCH)
- `pty:kill` — kill session

**Sessions:**
- `sessions:list` — list all sessions
- `sessions:fork` — fork a session

**Dictation:**
- `dictation:start` / `dictation:stop`
- `dictation:providers` — list available providers

**Model:**
- `model:set` — send `/model <name>` to PTY

## Setup

```bash
npm install
npm run rebuild  # rebuild node-pty for Electron's Node version
npm run dev
```

## Build

```bash
npm run package  # produces DMG (macOS) or NSIS (Windows)
```
