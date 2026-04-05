export interface DictationResult {
  text: string
  isFinal: boolean
  confidence?: number
}

export type DictationStatus = 'idle' | 'recording' | 'processing' | 'error'

export interface DictationProvider {
  readonly name: string
  readonly isLocal: boolean

  start(): Promise<void>
  stop(): void

  isAvailable(): Promise<boolean>

  onResult(cb: (result: DictationResult) => void): void
  onStatusChange(cb: (status: DictationStatus) => void): void
  onError(cb: (error: string) => void): void
}
