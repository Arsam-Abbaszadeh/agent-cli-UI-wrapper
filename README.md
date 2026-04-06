# Agent CLI UI Wrapper

An Electron app that wraps GitHub Copilot CLI with a desktop UI. Copilot runs in a real PTY inside the app, so everything still works the same — slash commands, interactive prompts, all of it — you just get a nicer place to do it.

---

## What it does

I got tired of losing Copilot sessions every time I closed a terminal window, and wanted to be able to talk to it instead of type. So I built this.

It's not a reimplementation of Copilot — it just wraps the CLI with:
- a sidebar to browse and resume past sessions
- voice dictation (local whisper or an external API)
- a model picker dropdown that sends `/model` to the active session
- an optional styled view that parses the terminal output into something cleaner to read

---

## Architecture

Standard Electron three-process setup:

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                  │
│  ├── PtyManager        spawn/resume/write/kill sessions  │
│  ├── SessionManager    discover sessions from filesystem │
│  └── DictationManager  local whisper or external API     │
├─────────────────────────────────────────────────────────┤
│  Preload (contextBridge)                                 │
│  └── window.api.*      secure IPC bridge to renderer    │
├─────────────────────────────────────────────────────────┤
│  Renderer (Vue 3 + Vite)                                 │
│  ├── TerminalView      xterm.js + WebGL rendering        │
│  ├── InputBar          text input + dictation toggle     │
│  ├── Sidebar           session browser                   │
│  ├── ModelPicker       model selection dropdown          │
│  └── AppView           styled HTML output view           │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** input → `InputBar` → IPC → `PtyManager` → Copilot CLI PTY → output streams back → `TerminalView` renders it via xterm.js.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Electron 41 |
| Build tooling | electron-vite |
| Frontend | Vue 3 + TypeScript |
| Terminal rendering | xterm.js 6 + WebGL addon |
| PTY management | node-pty |
| State management | Pinia |
| Persistence | electron-store |
| Local dictation | nodejs-whisper (whisper.cpp) |
| Styling | SASS + CSS variables |
| Packaging | electron-builder (DMG / NSIS) |

---

## Project Structure

```
src/
├── main/
│   ├── index.ts              # App entry, BrowserWindow setup
│   ├── pty-manager.ts        # Core PTY lifecycle management
│   ├── session-manager.ts    # Session discovery and forking
│   ├── ipc-handlers.ts       # IPC channel registrations
│   └── dictation/
│       ├── index.ts          # DictationManager (provider orchestration)
│       ├── local-whisper.ts  # Offline whisper.cpp transcription
│       └── external-api.ts   # OpenAI-compatible API transcription
├── preload/
│   └── index.ts              # contextBridge — exposes window.api
└── renderer/
    ├── components/
    │   ├── TerminalView.vue   # xterm.js wrapper with auto-resize
    │   ├── InputBar.vue       # Text input, dictation, mode switching
    │   ├── Sidebar.vue        # Session list and navigation
    │   ├── ModelPicker.vue    # Model dropdown
    │   ├── AppView.vue        # Styled HTML output view
    │   └── ViewToggle.vue     # Switch between terminal and app view
    ├── composables/
    │   ├── useTerminal.ts     # xterm.js ↔ PTY wiring
    │   ├── useSession.ts      # Session state
    │   ├── useDictation.ts    # Dictation state and providers
    │   └── useOutputBuffer.ts # Buffer PTY output for AppView
    ├── stores/
    │   └── app.ts             # Pinia store (active session, view mode)
    └── lib/
        └── block-parser.ts    # Parse ANSI output into HTML blocks
```

---

## Getting Started

You'll need Node.js 18+ and GitHub Copilot CLI installed and authenticated (`gh copilot` or `copilot`).

### Dev

```bash
npm install
npm run rebuild   # rebuild node-pty against Electron's Node version
npm run dev       # start with HMR
```

### Build

```bash
npm run package   # DMG on macOS, NSIS installer on Windows
```

### Type Check

```bash
npm run typecheck
```

---

## Configuration

Settings live in `~/.copilot-wrapper/settings.json`:

```json
{
  "general": {
    "defaultCwd": "~",
    "lastModel": "gpt-4-turbo"
  },
  "dictation": {
    "activeProvider": "local-whisper",
    "providers": {
      "local-whisper": { "model": "base.en", "language": "en" },
      "openai-api": {
        "endpoint": "https://api.openai.com/v1/audio/transcriptions",
        "apiKey": "sk-...",
        "model": "whisper-1"
      }
    }
  },
  "appearance": {
    "fontSize": 14,
    "fontFamily": "JetBrains Mono, Menlo, monospace"
  }
}
```

---

## Roadmap

- [ ] Conversation forking — branch off a session and show the fork tree in the sidebar
- [ ] Settings UI — right now you have to edit the JSON directly
- [ ] Session search — find past sessions by content or date
- [ ] Reasoning effort slider
- [ ] Export conversations as Markdown or PDF