import { BrowserWindow } from 'electron'
import type { DictationProvider, DictationResult, DictationStatus } from './provider'
import { LocalWhisperProvider } from './local-whisper'
import { ExternalApiProvider } from './external-api'

export interface DictationProviderInfo {
  name: string
  isLocal: boolean
  available: boolean
}

export class DictationManager {
  private providers = new Map<string, DictationProvider>()
  private activeProvider: DictationProvider | null = null
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow

    // Register built-in providers
    const localWhisper = new LocalWhisperProvider()
    const externalApi = new ExternalApiProvider()

    this.registerProvider(localWhisper)
    this.registerProvider(externalApi)
  }

  registerProvider(provider: DictationProvider): void {
    this.providers.set(provider.name, provider)

    // Wire events to IPC
    provider.onResult((result: DictationResult) => {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('dictation:result', result)
      }
    })

    provider.onStatusChange((status: DictationStatus) => {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('dictation:status', status)
      }
    })

    provider.onError((error: string) => {
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('dictation:error', error)
      }
    })
  }

  async setActiveProvider(name: string): Promise<void> {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`Unknown dictation provider: ${name}`)

    // Stop current provider if recording
    this.activeProvider?.stop()
    this.activeProvider = provider
  }

  async start(): Promise<void> {
    if (!this.activeProvider) {
      // Default to external-api as it's easier to set up
      this.activeProvider = this.providers.get('external-api') || null
    }
    await this.activeProvider?.start()
  }

  stop(): void {
    this.activeProvider?.stop()
  }

  async listProviders(): Promise<DictationProviderInfo[]> {
    const result: DictationProviderInfo[] = []
    for (const [, provider] of this.providers) {
      result.push({
        name: provider.name,
        isLocal: provider.isLocal,
        available: await provider.isAvailable()
      })
    }
    return result
  }

  getProvider(name: string): DictationProvider | undefined {
    return this.providers.get(name)
  }
}
