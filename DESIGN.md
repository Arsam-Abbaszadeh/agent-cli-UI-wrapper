# Agent CLI UI Wrapper — Technical Design

## 1. Problem Statement

Build a thin, cross-platform (macOS + Windows) desktop app that wraps **GitHub Copilot CLI**, adding:

1. **Dual-view** — toggle between raw terminal (xterm.js) and styled HTML chat view
2. **Dictation** (voice-to-text) — both local (whisper.cpp) and external API options
3. **Session management** — start new and resume existing Copilot CLI sessions
4. **Streaming terminal output** rendered in a styled app UI
5. **Model picker** — UI dropdown that maps to the `/model` slash command
5. **Conversation forking** — branch off an existing session (future)

The app is intentionally minimal — it does **not** replace Copilot CLI, it wraps it with a UI layer.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ PTY Manager│  │ Session Mgr  │  │ Dictation Mgr│ │
│  │ (node-pty) │  │              │  │              │ │
│  └─────┬──────┘  └──────┬───────┘  └──────┬───────┘ │
│        │                │                  │         │
│        │     IPC Bridge (contextBridge)     │         │
├────────┼────────────────┼──────────────────┼─────────┤
│  Electron Renderer Process (Chromium)                │
│  Vue 3 + TypeScript                                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ │
│  │ xterm.js │ │ Input Bar│ │ Sidebar │ │ Controls │ │
│  │ Terminal  │ │ + Dictate│ │Sessions │ │Model Pick│ │
│  └──────────┘ └──────────┘ └─────────┘ └──────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 3. Electron Primer — How It All Fits Together

Electron apps have **two types of processes** that you need to understand:

### 3.1 Main Process

- This is a **Node.js** process. It's the entry point of the app.
- It has full access to the OS: filesystem, native APIs, spawning child processes, etc.
- It creates and manages **BrowserWindows** (the app windows).
- There is exactly **one** main process per app.
- In our app, this is where we:
  - Spawn Copilot CLI via `node-pty` (pseudo-terminal)
  - Read the filesystem to discover sessions
  - Run audio capture + whisper.cpp for local dictation
  - Handle all "backend" logic

### 3.2 Renderer Process

- Each BrowserWindow runs a **Chromium** renderer — it's basically a browser tab.
- It runs HTML, CSS, and JavaScript (our Vue 3 app).
- It does **not** have direct access to Node.js APIs (for security).
- In our app, this is where we:
  - Render the terminal output via `xterm.js`
  - Display the sidebar, input bar, model picker
  - Handle user interactions

### 3.3 Preload Script & IPC (How They Talk)

Since the renderer can't access Node.js directly, Electron provides a **preload script** that runs before the renderer's web page loads. It has access to both Node.js and the DOM.

We use `contextBridge.exposeInMainWorld()` in the preload script to expose a safe API object (`window.api`) that the renderer can call.

Communication between main and renderer happens via **IPC** (Inter-Process Communication):

```
Renderer                   Preload                    Main
───────                    ───────                    ────
window.api.pty.write() --> ipcRenderer.send() ------> ipcMain.on('pty:write')
                                                          │
                                                     pty.write(data)
                                                          │
                                                     pty.onData(output)
                                                          │
window.api.pty.onData() <-- ipcRenderer.on() <------ win.webContents.send()
```

**Two IPC patterns:**
- `ipcRenderer.send()` / `ipcMain.on()` — fire-and-forget (good for streaming data like terminal output)
- `ipcRenderer.invoke()` / `ipcMain.handle()` — request/response with a Promise (good for fetching session lists, etc.)

### 3.4 File/Folder Layout in an Electron-Vite Project

```
project/
├── electron.vite.config.ts   ← Build config for all 3 targets
├── package.json
├── src/
│   ├── main/                 ← Main process code (Node.js)
│   │   └── index.ts          ← App entry: creates window, registers IPC handlers
│   ├── preload/              ← Preload script
│   │   └── index.ts          ← Exposes window.api via contextBridge
│   └── renderer/             ← Renderer process (Vue app)
│       ├── index.html        ← HTML entry point loaded by BrowserWindow
│       ├── main.ts           ← Vue app bootstrap
│       ├── App.vue           ← Root Vue component
│       └── components/       ← Vue components
├── resources/                ← App icons, static assets
└── out/                      ← Built output (generated)
```

`electron-vite` is a build tool that compiles all three targets (main, preload, renderer) using Vite. It handles:
- TypeScript compilation for main/preload (Node.js targets)
- Vue SFC compilation + HMR for renderer (browser target)
- Native module handling (node-pty needs C++ compilation)

### 3.5 How a BrowserWindow Is Created

```typescript
// In src/main/index.ts
import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),  // Preload script
      contextIsolation: true,   // Security: renderer can't access Node.js
      nodeIntegration: false,   // Security: no require() in renderer
    },
  });

  // In dev: load Vite dev server URL
  // In prod: load built HTML file
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
});
```

### 3.6 Native Modules in Electron

`node-pty` is a **native Node.js module** — it contains C++ code that gets compiled for your platform. Electron uses a different V8/Node version than your system Node, so native modules must be **rebuilt** for Electron's specific version.

This is handled by `electron-rebuild`:
```bash
npx electron-rebuild -f -w node-pty
```

This runs automatically via our `postinstall` npm script.

---

## 4. Tech Stack

| Layer               | Technology                                        | Why                                              |
|---------------------|---------------------------------------------------|--------------------------------------------------|
| Framework           | Electron (latest stable)                          | Cross-platform desktop, Chromium + Node.js       |
| Build Tool          | electron-vite                                     | Vite-based, fast HMR, handles all 3 targets      |
| Frontend            | Vue 3 + TypeScript + Composition API              | Lightweight, reactive, good TS support           |
| Terminal Rendering  | xterm.js + addon-fit + addon-webgl                | Full ANSI fidelity — Copilot output looks perfect|
| PTY                 | node-pty (by Microsoft)                           | Spawn real terminals from Node.js                |
| Dictation (local)   | nodejs-whisper (whisper.cpp bindings)              | Offline STT, runs on CPU/GPU                     |
| Dictation (external)| OpenAI Whisper API / any compatible endpoint       | Plug-and-play cloud STT                          |
| State               | Pinia (Vue store)                                 | Lightweight state management                     |
| Settings            | electron-store                                    | Persistent JSON settings                         |
| Styling             | Plain CSS (custom dark theme)                     | Simple, no framework overhead                    |
| Packaging           | electron-builder                                  | DMG (macOS), NSIS installer (Windows)            |

---

## 5. Why xterm.js for Terminal Rendering

Copilot CLI produces rich terminal output: ANSI colors, cursor movement, spinners, progress bars, interactive prompts (y/n, arrow-key selection), tables, and more.

**Option A (rejected)**: Parse ANSI codes, strip formatting, render as HTML. This is fragile, lossy, and would break every time Copilot CLI changes its output format.

**Option B (chosen)**: Embed `xterm.js` — a real terminal emulator in the browser. It renders ANSI output perfectly because it's a proper VT100/xterm terminal. VS Code's integrated terminal uses xterm.js.

Benefits:
- Zero ANSI parsing — everything just works
- Keyboard passthrough for interactive prompts
- Resize support (SIGWINCH)
- Scrollback buffer with search
- WebGL-accelerated rendering (smooth even with lots of output)

---

## 6. Detailed Project Structure

```
agentCliUiWrapper/
├── electron.vite.config.ts       # electron-vite build configuration
├── package.json
├── tsconfig.json                 # Base TypeScript config
├── tsconfig.node.json            # TS config for main + preload (Node.js target)
├── tsconfig.web.json             # TS config for renderer (browser target)
├── env.d.ts                      # Type declarations for window.api
├── resources/                    # App icons (icon.png, icon.icns, icon.ico)
│
├── src/
│   ├── main/                     # ═══ MAIN PROCESS (Node.js) ═══
│   │   ├── index.ts              # App entry: window creation, lifecycle
│   │   ├── pty-manager.ts        # Spawn/write/resize/kill Copilot CLI PTYs
│   │   ├── session-manager.ts    # Discover + fork sessions from filesystem
│   │   ├── ipc-handlers.ts       # Register all IPC channels
│   │   └── dictation/
│   │       ├── index.ts          # DictationManager (orchestrates providers)
│   │       ├── provider.ts       # DictationProvider interface definition
│   │       ├── local-whisper.ts  # Local whisper.cpp provider
│   │       └── external-api.ts   # External HTTP API provider
│   │
│   ├── preload/                  # ═══ PRELOAD SCRIPT ═══
│   │   └── index.ts              # contextBridge: exposes window.api
│   │
│   └── renderer/                 # ═══ RENDERER PROCESS (Vue 3) ═══
│       ├── index.html            # HTML shell loaded by BrowserWindow
│       ├── main.ts               # Vue app creation + mount
│       ├── App.vue               # Root layout component
│       ├── components/
│       │   ├── TerminalView.vue  # xterm.js wrapper + auto-resize
│       │   ├── InputBar.vue      # Text input + send + dictation trigger
│       │   ├── Sidebar.vue       # Session list, new/resume
│       │   ├── ModelPicker.vue   # Model selection dropdown
│       │   └── DictationButton.vue  # Mic toggle with recording state
│       ├── composables/
│       │   ├── useTerminal.ts    # xterm.js lifecycle + IPC wiring
│       │   ├── useSession.ts     # Session state management
│       │   ├── useDictation.ts   # Dictation state + provider switching
│       │   └── useModelPicker.ts # Model list + selection logic
│       ├── stores/
│       │   └── app.ts            # Pinia store: active session, app state
│       └── styles/
│           └── main.css          # Dark theme, layout, typography
│
└── build/                        # electron-builder config (platform targets)
```

---

## 7. Core Components — Detailed Design

### 7.1 PTY Manager (`src/main/pty-manager.ts`)

This is the heart of the app — it manages Copilot CLI processes.

**What is node-pty?**
`node-pty` creates **pseudo-terminals** — the same mechanism your terminal app (iTerm, Windows Terminal) uses. When you spawn a process through node-pty, that process thinks it's running in a real terminal. This means:
- Copilot CLI's colors, spinners, and interactive prompts all work
- The process receives SIGWINCH when we resize (so it reflows output)
- stdin/stdout behave exactly like a terminal (line buffering, raw mode, etc.)

**Interface:**

```typescript
interface PtySession {
  id: string;                     // Our internal UUID
  copilotSessionId?: string;      // Copilot's session UUID
  pty: IPty;                      // node-pty instance
  cwd: string;
  status: 'running' | 'exited';
}

class PtyManager {
  private sessions: Map<string, PtySession>;
  private mainWindow: BrowserWindow;

  spawn(cwd: string, args?: string[]): PtySession
  resume(copilotSessionId: string): PtySession
  write(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void
  kill(sessionId: string): void
}
```

**Spawn flow:**

```typescript
spawn(cwd: string, args: string[] = []): PtySession {
  // On macOS: spawn a login shell that runs `copilot`
  // On Windows: spawn cmd.exe /c copilot
  // Using a login shell ensures PATH, environment, etc. are fully loaded
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh';
  const shellArgs = process.platform === 'win32'
    ? ['/c', 'copilot', ...args]
    : ['-lc', `copilot ${args.join(' ')}`];

  const pty = nodePty.spawn(shell, shellArgs, {
    name: 'xterm-256color',       // Terminal type (affects ANSI capabilities)
    cols: 120,                    // Initial width in characters
    rows: 30,                     // Initial height in rows
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const session: PtySession = { id: uuid(), pty, cwd, status: 'running' };

  // When Copilot CLI writes output → send to renderer via IPC
  pty.onData((data: string) => {
    this.mainWindow.webContents.send(`pty:data:${session.id}`, data);
  });

  // When Copilot CLI exits
  pty.onExit(({ exitCode }) => {
    session.status = 'exited';
    this.mainWindow.webContents.send(`pty:exit:${session.id}`, exitCode);
  });

  this.sessions.set(session.id, session);
  return session;
}
```

**Resume flow** — just spawn with `--resume`:

```typescript
resume(copilotSessionId: string): PtySession {
  return this.spawn(os.homedir(), ['--resume', copilotSessionId]);
}
```

**Write** — sends user input to Copilot CLI's stdin:

```typescript
write(sessionId: string, data: string): void {
  this.sessions.get(sessionId)?.pty.write(data);
}
```

**Resize** — tells the PTY the terminal size changed (Copilot CLI reflows output):

```typescript
resize(sessionId: string, cols: number, rows: number): void {
  this.sessions.get(sessionId)?.pty.resize(cols, rows);
}
```

### 7.2 Session Manager (`src/main/session-manager.ts`)

Discovers existing Copilot CLI sessions from the filesystem.

Copilot CLI stores session state at `~/.copilot/session-state/`. Each session is a directory named by UUID containing conversation history and context.

```typescript
interface CopilotSession {
  id: string;            // UUID directory name
  lastModified: Date;    // From filesystem stat
}

class SessionManager {
  private sessionDir = path.join(os.homedir(), '.copilot', 'session-state');

  // List all sessions, sorted by most recent first
  async listSessions(): Promise<CopilotSession[]> {
    const entries = await fs.readdir(this.sessionDir);
    // For each entry, stat for modification time
    // Filter to UUID-formatted directories only
    // Sort by lastModified descending
  }

  // Fork: copy a session directory to a new UUID
  async forkSession(sessionId: string): Promise<string> {
    const newId = uuid();
    await fs.cp(
      path.join(this.sessionDir, sessionId),
      path.join(this.sessionDir, newId),
      { recursive: true }
    );
    return newId;
  }
}
```

### 7.3 IPC Handlers (`src/main/ipc-handlers.ts`)

Registers all IPC channels that the renderer can call. This is the "API surface" between main and renderer.

```typescript
export function registerIpcHandlers(
  ptyManager: PtyManager,
  sessionManager: SessionManager,
  dictationManager: DictationManager
) {
  // --- PTY ---
  ipcMain.handle('pty:spawn', (_e, cwd: string, args?: string[]) => {
    const session = ptyManager.spawn(cwd, args);
    return { id: session.id };  // Return session ID to renderer
  });

  ipcMain.handle('pty:resume', (_e, copilotSessionId: string) => {
    const session = ptyManager.resume(copilotSessionId);
    return { id: session.id };
  });

  ipcMain.on('pty:write', (_e, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });

  ipcMain.on('pty:resize', (_e, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows);
  });

  ipcMain.on('pty:kill', (_e, sessionId: string) => {
    ptyManager.kill(sessionId);
  });

  // --- Sessions ---
  ipcMain.handle('sessions:list', () => sessionManager.listSessions());
  ipcMain.handle('sessions:fork', (_e, id: string) => sessionManager.forkSession(id));

  // --- Dictation ---
  ipcMain.handle('dictation:start', () => dictationManager.start());
  ipcMain.on('dictation:stop', () => dictationManager.stop());
  ipcMain.handle('dictation:providers', () => dictationManager.listProviders());
  ipcMain.handle('dictation:setProvider', (_e, name: string) =>
    dictationManager.setActiveProvider(name));

  // --- Model ---
  ipcMain.handle('model:set', (_e, sessionId: string, model: string) => {
    // Send the /model slash command directly to Copilot CLI
    ptyManager.write(sessionId, `/model ${model}\n`);
  });
}
```

### 7.4 Preload Script (`src/preload/index.ts`)

This script runs before the renderer page loads. It creates the `window.api` object that the Vue app uses.

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  pty: {
    spawn: (cwd: string, args?: string[]) =>
      ipcRenderer.invoke('pty:spawn', cwd, args),
    resume: (sessionId: string) =>
      ipcRenderer.invoke('pty:resume', sessionId),
    write: (sessionId: string, data: string) =>
      ipcRenderer.send('pty:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', sessionId, cols, rows),
    kill: (sessionId: string) =>
      ipcRenderer.send('pty:kill', sessionId),
    onData: (sessionId: string, cb: (data: string) => void) => {
      const handler = (_e: any, data: string) => cb(data);
      ipcRenderer.on(`pty:data:${sessionId}`, handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener(`pty:data:${sessionId}`, handler);
    },
    onExit: (sessionId: string, cb: (code: number) => void) => {
      ipcRenderer.on(`pty:exit:${sessionId}`, (_e, code) => cb(code));
    },
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    fork: (sessionId: string) => ipcRenderer.invoke('sessions:fork', sessionId),
  },
  dictation: {
    start: () => ipcRenderer.invoke('dictation:start'),
    stop: () => ipcRenderer.send('dictation:stop'),
    onResult: (cb: (result: any) => void) => {
      ipcRenderer.on('dictation:result', (_e, result) => cb(result));
    },
    listProviders: () => ipcRenderer.invoke('dictation:providers'),
    setProvider: (name: string) => ipcRenderer.invoke('dictation:setProvider', name),
  },
  model: {
    set: (sessionId: string, modelName: string) =>
      ipcRenderer.invoke('model:set', sessionId, modelName),
  },
});
```

The renderer (Vue app) then accesses all of this via `window.api.pty.spawn(...)` etc.

### 7.5 Renderer — Vue Components

**App Layout:**

```
┌─────────────────────────────────────────────┐
│ Titlebar (draggable, frameless window)      │
├────────┬────────────────────────────────────┤
│        │  ┌──────────────────────────────┐  │
│ Side-  │  │                              │  │
│ bar    │  │    TerminalView (xterm.js)   │  │
│        │  │    fills remaining space     │  │
│ + New  │  │                              │  │
│ ───────│  └──────────────────────────────┘  │
│ Sess 1 │  ┌──────────────────────────────┐  │
│ Sess 2 │  │ [Model ▾] [🎤] [___input___]│  │
│ Sess 3 │  └──────────────────────────────┘  │
│        │                                    │
│Settings│                                    │
├────────┴────────────────────────────────────┤
│ Status: cwd, session info                   │
└─────────────────────────────────────────────┘
```

**TerminalView.vue** — wraps xterm.js:

```typescript
// composable: useTerminal.ts
export function useTerminal(containerRef: Ref<HTMLElement>) {
  const terminal = new Terminal({
    theme: { background: '#1a1a2e', foreground: '#e0e0e0' },
    fontFamily: 'JetBrains Mono, Menlo, monospace',
    fontSize: 14,
    cursorBlink: true,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebglAddon());

  onMounted(() => {
    terminal.open(containerRef.value);
    fitAddon.fit();
  });

  // Wire to PTY IPC
  function attachSession(sessionId: string) {
    // Output from Copilot CLI → render in terminal
    window.api.pty.onData(sessionId, (data) => terminal.write(data));

    // Keyboard input in terminal → send to Copilot CLI
    terminal.onData((data) => window.api.pty.write(sessionId, data));

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      window.api.pty.resize(sessionId, cols, rows);
    });
  }

  // Auto-resize when window changes
  window.addEventListener('resize', () => fitAddon.fit());

  return { terminal, attachSession };
}
```

**InputBar.vue:**
- A text `<textarea>` with auto-grow
- On Enter (without Shift): writes `text + \n` to the PTY via `window.api.pty.write()`
- This is essentially typing into Copilot CLI's stdin
- Dictation button on the right starts/stops recording
- Model picker dropdown on the left

**Input mode concern:**
The input bar intercepts text input. But sometimes you need direct terminal access (arrow keys for Copilot's interactive menus, Shift+Tab for mode switching, Ctrl+C, etc.). Solution:
- **Default**: Input bar is focused, text goes through it
- **Escape key**: Focuses the terminal directly — keystrokes go straight to the PTY
- **Click input bar or Tab**: Returns focus to the input bar
- Visual indicator shows which mode is active

**ModelPicker.vue:**
- Dropdown with known models (hardcoded list to start)
- On selection: `window.api.model.set(sessionId, 'gpt-5.4')` → writes `/model gpt-5.4\n` to PTY
- Displays currently selected model name

**Sidebar.vue:**
- Calls `window.api.sessions.list()` on mount to fetch sessions
- Shows session UUIDs (or friendly timestamps) sorted by recency
- "+ New thread" button → `window.api.pty.spawn(cwd)`
- Click session → `window.api.pty.resume(sessionId)`
- Right-click → "Fork" (future)

---

## 8. Dictation System

### 8.1 Pluggable Provider Architecture

```typescript
// src/main/dictation/provider.ts
interface DictationProvider {
  readonly name: string;
  readonly isLocal: boolean;

  start(): void;                     // Begin recording + transcribing
  stop(): void;                      // Stop recording
  isAvailable(): Promise<boolean>;   // Model downloaded? API key set?

  // Events
  onResult(cb: (result: DictationResult) => void): void;
}

interface DictationResult {
  text: string;
  isFinal: boolean;    // false = interim/partial, true = final transcript
  confidence?: number;
}
```

### 8.2 Local Provider — whisper.cpp (`local-whisper.ts`)

```
┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│ Mic Capture   │───→│ VAD + Chunk  │───→│ whisper.cpp    │
│ (mic npm pkg) │    │ (voice       │    │ (nodejs-whisper)│
└──────────────┘    │  activity    │    └───────┬────────┘
                    │  detection)  │            │
                    └──────────────┘     DictationResult
```

**How it works:**
1. Records audio from the system microphone using the `mic` npm package (wraps platform-native audio capture — SoX on macOS, NAudio-compatible on Windows)
2. Applies **Voice Activity Detection (VAD)** — detects when the user is speaking vs. silence. Can use simple energy-based detection or `@ricky0123/vad-web` (Silero VAD model)
3. When a speech segment ends (silence detected), sends the audio buffer to `nodejs-whisper` for transcription
4. `nodejs-whisper` runs the Whisper model locally via whisper.cpp — entirely offline, no network needed
5. Returns the transcribed text as a `DictationResult`

**Model management:**
- Models stored in `~/.copilot-wrapper/models/`
- Auto-downloaded on first use
- Model options: `tiny.en` (~39MB, fast, less accurate) or `base.en` (~74MB, good balance)
- Configurable in settings

**Tradeoffs:**
- ✅ Fully offline, private
- ✅ No API costs
- ⚠️ Requires ~500MB RAM for base model
- ⚠️ First transcription may be slow (model loading), subsequent ones are fast
- ⚠️ `mic` package requires SoX installed on macOS (`brew install sox`); may need an alternative for Windows

### 8.3 External API Provider (`external-api.ts`)

```
┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│ Mic Capture   │───→│ Audio Buffer │───→│ HTTP POST      │
│              │    │ (WAV format) │    │ /v1/audio/     │
└──────────────┘    └──────────────┘    │ transcriptions │
                                        └───────┬────────┘
                                                │
                                         DictationResult
```

**How it works:**
1. Same mic capture as local
2. Encodes audio as WAV
3. POSTs to an OpenAI-compatible `/v1/audio/transcriptions` endpoint
4. Returns transcribed text

**Compatible services:**
- OpenAI Whisper API (`https://api.openai.com/v1/audio/transcriptions`)
- Groq (Whisper) — very fast, cheap
- LocalAI (self-hosted, same endpoint format)
- Any Whisper-compatible API

**Configuration (stored in settings):**
```json
{
  "endpoint": "https://api.openai.com/v1/audio/transcriptions",
  "apiKey": "sk-...",
  "model": "whisper-1"
}
```

**Tradeoffs:**
- ✅ Better accuracy (especially Groq/OpenAI large models)
- ✅ No local compute needed
- ✅ Very easy to set up (just an API key)
- ⚠️ Requires internet
- ⚠️ Costs money (though Groq is very cheap / has a free tier)
- ⚠️ Audio sent to external server

### 8.4 DictationManager

Orchestrates providers and bridges to IPC:

```typescript
class DictationManager {
  private providers: Map<string, DictationProvider> = new Map();
  private activeProvider: DictationProvider | null = null;
  private mainWindow: BrowserWindow;

  registerProvider(provider: DictationProvider): void;
  setActiveProvider(name: string): void;

  start(): void {
    this.activeProvider?.start();
    this.activeProvider?.onResult((result) => {
      // Forward to renderer
      this.mainWindow.webContents.send('dictation:result', result);
    });
  }

  stop(): void {
    this.activeProvider?.stop();
  }

  listProviders(): { name: string; isLocal: boolean; available: boolean }[];
}
```

### 8.5 Dictation UX Flow

```
User clicks 🎤 (or presses Cmd+Shift+D)
        │
        ▼
Renderer calls window.api.dictation.start()
        │
        ▼
Main: DictationManager.start() → mic starts recording
        │
        ▼
Audio chunks → whisper (local) or API (external)
        │
        ▼
DictationResult { text: "create a new React component", isFinal: true }
        │
        ▼
IPC: mainWindow.send('dictation:result', result)
        │
        ▼
Renderer: InputBar receives result
        │
        ├─ isFinal=false → show as grey placeholder text (updating live)
        └─ isFinal=true  → insert into textarea as confirmed text
        │
        ▼
User reviews text, optionally edits, presses Enter to send
```

---

## 9. Data Flow Diagrams

### 9.1 Sending a Message

```
User types "fix the login bug" in InputBar → presses Enter
        │
        ▼
InputBar.submit()
        │
        ▼
window.api.pty.write(sessionId, "fix the login bug\n")
        │
        ▼
Preload: ipcRenderer.send('pty:write', sessionId, data)
        │
        ▼
Main: ipcMain.on('pty:write') → ptyManager.write() → pty.write(data)
        │
        ▼
Copilot CLI receives "fix the login bug\n" on stdin
        │
        ▼
Copilot CLI thinks, runs tools, writes output to stdout
        │
        ▼
Main: pty.onData(output) → mainWindow.send('pty:data:${id}', output)
        │
        ▼
Preload: ipcRenderer.on('pty:data:${id}')
        │
        ▼
Renderer: useTerminal.onData → terminal.write(output)
        │
        ▼
xterm.js renders the ANSI output visually (colors, formatting, etc.)
```

### 9.2 Model Selection

```
User selects "Claude Sonnet 4" from ModelPicker dropdown
        │
        ▼
window.api.model.set(sessionId, 'claude-sonnet-4')
        │
        ▼
Main: pty.write('/model claude-sonnet-4\n')
        │
        ▼
Copilot CLI processes the /model command, switches model
        │
        ▼
Output appears in terminal confirming the switch
```

### 9.3 Resuming a Session

```
User clicks "Session abc123..." in Sidebar
        │
        ▼
window.api.pty.resume('abc123...')
        │
        ▼
Main: ptyManager.resume() → spawns `copilot --resume abc123...`
        │
        ▼
Copilot CLI loads session state, prints conversation context
        │
        ▼
Output streams to xterm.js in the terminal view
```

---

## 10. Settings & Persistence

| What                | Where                                        | How                  |
|---------------------|----------------------------------------------|----------------------|
| App settings        | `~/.copilot-wrapper/settings.json`           | electron-store       |
| Session metadata    | Copilot CLI's own `~/.copilot/session-state/`| Read-only discovery  |
| Fork metadata       | `~/.copilot-wrapper/sessions.db` (future)    | better-sqlite3       |
| Whisper models      | `~/.copilot-wrapper/models/`                 | Auto-downloaded      |
| Window state        | electron-store (x, y, width, height)         | Save on close        |

**Settings structure:**
```json
{
  "general": {
    "defaultCwd": "~",
    "lastModel": "claude-sonnet-4"
  },
  "dictation": {
    "activeProvider": "local-whisper",
    "autoSend": false,
    "hotkey": "CommandOrControl+Shift+D",
    "providers": {
      "local-whisper": {
        "model": "base.en",
        "language": "en"
      },
      "openai-api": {
        "endpoint": "https://api.openai.com/v1/audio/transcriptions",
        "apiKey": "",
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

## 11. Key Dependencies

| Package               | Purpose                           | Notes                            |
|-----------------------|-----------------------------------|----------------------------------|
| `electron`            | App framework                     | Dev dep, ~180MB                  |
| `electron-vite`       | Build tool (main+preload+renderer)| Dev dep                          |
| `vue`                 | UI framework                      | ~90KB                            |
| `@vitejs/plugin-vue`  | Vue SFC compilation for Vite      | Dev dep                          |
| `typescript`          | Type safety                       | Dev dep                          |
| `vue-tsc`             | Vue TypeScript checker            | Dev dep                          |
| `node-pty`            | Pseudo-terminal spawning          | Native module, needs rebuild     |
| `@xterm/xterm`        | Terminal UI renderer              | ~400KB                           |
| `@xterm/addon-fit`    | Auto-resize terminal to container | ~10KB                            |
| `@xterm/addon-webgl`  | GPU-accelerated rendering         | ~200KB                           |
| `pinia`               | Vue state management              | ~15KB                            |
| `electron-store`      | Persistent settings               | ~30KB                            |
| `nodejs-whisper`      | Local whisper.cpp STT             | Native, needs whisper model DL   |
| `mic`                 | Microphone audio capture          | Requires SoX on macOS            |
| `electron-builder`    | Packaging (DMG, NSIS)             | Dev dep                          |
| `electron-rebuild`    | Rebuild native modules for Electron| Dev dep                         |

---

## 12. Conversation Forking (Future)

### Concept
At any point in a conversation, "fork" to create a branching copy. The original continues unchanged; the fork starts from the same point but can diverge.

### How It Works
1. Copy the Copilot session state directory (`~/.copilot/session-state/<id>`) to a new UUID
2. Resume the new copy via `copilot --resume <new-id>`
3. Store fork metadata (parent → child relationship) in local SQLite DB
4. UI shows sessions with fork indicators

### Risks
- Copilot CLI's session state format is internal and undocumented — it may change
- Need to verify that copied directories produce valid resumed sessions
- This is the riskiest feature and should be prototyped early

---

## 13. Open Questions & Risks

| # | Question                                                    | Impact | Notes                                                    |
|---|-------------------------------------------------------------|--------|----------------------------------------------------------|
| 1 | **Input mode switching**: How to cleanly toggle between input bar and direct terminal passthrough? | UX | Needed for arrow-key menus, Shift+Tab mode switching. Proposed: Esc to focus terminal, Tab/click to return to input bar |
| 2 | **Reasoning effort control**: Copilot CLI uses arrow-key slider for reasoning which doesn't stream initially | UX | Could add a separate UI control that sends the CLI flag directly, or defer |
| 3 | **Audio capture on Windows**: `mic` npm depends on SoX which is macOS/Linux-focused | Dictation | May need a Windows-specific audio package or use Web Audio API in renderer |
| 4 | **node-pty on Windows**: ConPTY (Win10 1809+) generally works but may have edge cases | Core | Test early on Windows                                    |
| 5 | **Session state stability**: Copilot's `~/.copilot/session-state/` format is internal | Sessions | Forking depends on it being safely copyable              |
| 6 | **Whisper model download UX**: First-time setup downloads 40-75MB | Dictation | Need a progress indicator and graceful handling           |

---

## 14. Implementation Phases

### Phase 1: Core Shell (MVP)
- Electron + electron-vite + Vue 3 + TypeScript scaffold
- `node-pty` PTY manager: spawn `copilot`, stream output
- `xterm.js` terminal view rendering output
- Input bar: text input → PTY stdin
- Basic dark theme matching Copilot aesthetic
- Esc/Tab input mode switching

### Phase 2: Session Management
- Session discovery from `~/.copilot/session-state/`
- Sidebar component with session list
- Resume sessions via `copilot --resume <id>`
- New session creation
- `copilot --continue` for quick last-session resume

### Phase 3: Model Picker
- Model dropdown UI (hardcoded model list initially)
- Sends `/model <name>\n` to PTY on selection
- Persist last-used model in settings

### Phase 4: Dictation — Local (whisper.cpp)
- Microphone capture
- Voice Activity Detection for chunking
- `nodejs-whisper` integration
- Interim + final results displayed in input bar
- Whisper model download management + settings UI

### Phase 5: Dictation — External API
- OpenAI-compatible HTTP API provider
- Settings UI for endpoint + API key
- Provider switcher (local vs. external) in UI

### Phase 6: Conversation Forking
- Fork session (copy state directory to new UUID)
- Fork metadata in local SQLite DB
- UI for viewing fork relationships in sidebar
