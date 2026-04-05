import { EventEmitter } from 'events'
import * as https from 'https'
import * as http from 'http'
import type { DictationProvider, DictationResult, DictationStatus } from './provider'

interface ExternalApiConfig {
  endpoint: string
  apiKey: string
  model: string
}

/**
 * External API dictation provider.
 * Sends recorded audio to an OpenAI-compatible /v1/audio/transcriptions endpoint.
 *
 * Compatible with: OpenAI Whisper API, Groq, LocalAI, or any Whisper-compatible service.
 *
 * This is a stub for the network + recording integration.
 * The mic capture happens in the renderer (Web Audio API) and audio
 * data is sent to main via IPC, then forwarded to the API.
 */
export class ExternalApiProvider implements DictationProvider {
  readonly name = 'external-api'
  readonly isLocal = false

  private emitter = new EventEmitter()
  private status: DictationStatus = 'idle'
  private config: ExternalApiConfig
  private recording = false

  constructor(config?: Partial<ExternalApiConfig>) {
    this.config = {
      endpoint: config?.endpoint || 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: config?.apiKey || '',
      model: config?.model || 'whisper-1'
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.config.apiKey.length > 0
  }

  async start(): Promise<void> {
    if (this.recording) return

    if (!this.config.apiKey) {
      this.emitter.emit('error', 'No API key configured. Set one in Settings → Dictation → External API.')
      this.setStatus('error')
      return
    }

    this.recording = true
    this.setStatus('recording')

    // TODO: Actual implementation will:
    // 1. Receive audio data from renderer via IPC (recorder in renderer using Web Audio API)
    // 2. Accumulate into a WAV buffer
    // 3. POST multipart/form-data to the configured endpoint
    // 4. Parse JSON response for transcribed text
    // 5. Emit DictationResult
    //
    // Placeholder for now so UI wiring works.
  }

  stop(): void {
    this.recording = false
    this.setStatus('idle')
  }

  /** Called by DictationManager when audio data arrives from the renderer */
  async transcribe(audioBuffer: Buffer, mimeType: string = 'audio/wav'): Promise<void> {
    this.setStatus('processing')

    try {
      const text = await this.callApi(audioBuffer, mimeType)
      this.emitter.emit('result', {
        text,
        isFinal: true
      } satisfies DictationResult)
    } catch (err: any) {
      this.emitter.emit('error', `Transcription failed: ${err.message}`)
    } finally {
      if (this.recording) {
        this.setStatus('recording')
      } else {
        this.setStatus('idle')
      }
    }
  }

  private callApi(audioBuffer: Buffer, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.endpoint)
      const isHttps = url.protocol === 'https:'

      const boundary = `----formdata-${Date.now()}`
      const parts: Buffer[] = []

      // file field
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: ${mimeType}\r\n\r\n`
      ))
      parts.push(audioBuffer)
      parts.push(Buffer.from('\r\n'))

      // model field
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${this.config.model}\r\n`
      ))

      parts.push(Buffer.from(`--${boundary}--\r\n`))
      const body = Buffer.concat(parts)

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }

      const req = (isHttps ? https : http).request(options, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString()
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(responseBody)
              resolve(json.text || '')
            } catch {
              resolve(responseBody)
            }
          } else {
            reject(new Error(`API returned ${res.statusCode}: ${responseBody}`))
          }
        })
      })

      req.on('error', reject)
      req.write(body)
      req.end()
    })
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

  updateConfig(config: Partial<ExternalApiConfig>): void {
    Object.assign(this.config, config)
  }
}
