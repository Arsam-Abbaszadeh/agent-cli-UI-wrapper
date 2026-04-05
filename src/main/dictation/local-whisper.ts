import { EventEmitter } from 'events'
import type { DictationProvider, DictationResult, DictationStatus } from './provider'

/**
 * Local dictation using whisper.cpp (via nodejs-whisper).
 *
 * This is a stub implementation that provides the full interface.
 * Actual whisper.cpp integration requires:
 *   npm install nodejs-whisper mic
 * and a downloaded Whisper model (~40-75MB).
 *
 * The architecture is ready — mic capture → VAD chunking → whisper transcription.
 */
export class LocalWhisperProvider implements DictationProvider {
  readonly name = 'local-whisper'
  readonly isLocal = true

  private emitter = new EventEmitter()
  private status: DictationStatus = 'idle'
  private recording = false

  async isAvailable(): Promise<boolean> {
    // Check if nodejs-whisper is installed and a model is downloaded
    try {
      require.resolve('nodejs-whisper')
      return true
    } catch {
      return false
    }
  }

  async start(): Promise<void> {
    if (this.recording) return

    this.recording = true
    this.setStatus('recording')

    // TODO: When nodejs-whisper + mic are installed, this will:
    // 1. Start mic capture via the `mic` npm package
    // 2. Buffer audio with voice activity detection
    // 3. On speech-end, send chunk to nodejs-whisper
    // 4. Emit DictationResult via onResult callback
    //
    // For now, emit a placeholder so the UI flow works end-to-end.

    this.emitter.emit('error', 'Local whisper not yet configured. Install nodejs-whisper and download a model.')
    this.setStatus('error')
    this.recording = false
  }

  stop(): void {
    this.recording = false
    this.setStatus('idle')
  }

  onResult(cb: (result: DictationResult) => void): void {
    this.emitter.on('result', cb)
  }

  onStatusChange(cb: (status: DictationStatus) => void): void {
    this.emitter.on('status', cb)
  }

  onError(cb: (error: string) => void): void {
    this.emitter.on('error', cb)
  }

  private setStatus(status: DictationStatus): void {
    this.status = status
    this.emitter.emit('status', status)
  }
}
