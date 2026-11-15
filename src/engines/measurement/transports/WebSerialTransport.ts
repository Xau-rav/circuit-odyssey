import {
  countsToVolts,
  decodeFrames,
  encodeControlLine,
  parseCapabilities,
  parseControlLine,
} from '../protocol'
import type { DeviceCapabilities } from '../../../core/types'
import type { MeasurementTransport, SampleBatch, TransportListener } from './types'

/**
 * Chrome/Edge Web Serial client for UNO Q Monitor/CDC path.
 * Honest about support: Safari/Firefox → unsupported.
 */
export class WebSerialTransport implements MeasurementTransport {
  readonly id = 'webserial'
  readonly label = 'Web Serial (UNO Q Monitor)'
  readonly source = 'physical' as const

  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private listeners = new Set<TransportListener>()
  private state:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'streaming'
    | 'error'
    | 'unsupported' = 'disconnected'
  private textBuf = ''
  private binBuf: Uint8Array = new Uint8Array(0)
  private caps: DeviceCapabilities | null = null
  private readLoopActive = false
  private sampleRateHz = 1000
  private lastError: string | null = null

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  getLastError(): string | null {
    return this.lastError
  }

  async connect(): Promise<void> {
    if (!WebSerialTransport.isSupported()) {
      this.state = 'unsupported'
      this.lastError =
        'Web Serial API unavailable. Use Chrome or Edge on desktop.'
      throw new Error(this.lastError)
    }
    this.state = 'connecting'
    try {
      this.port = await navigator.serial.requestPort()
      await this.port.open({ baudRate: 115200 })
      this.writer = this.port.writable!.getWriter()
      this.reader = this.port.readable!.getReader()
      this.readLoopActive = true
      void this.readLoop()
      await this.writeLine(encodeControlLine('HELLO'))
      await this.delay(200)
      await this.writeLine(encodeControlLine('GET_CAPABILITIES'))
      await this.delay(300)
      this.state = 'connected'
    } catch (e) {
      this.state = 'error'
      this.lastError = e instanceof Error ? e.message : String(e)
      await this.disconnect()
      throw e
    }
  }

  async disconnect(): Promise<void> {
    this.readLoopActive = false
    try {
      await this.reader?.cancel()
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock()
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close()
    } catch {
      /* ignore */
    }
    this.reader = null
    this.writer = null
    this.port = null
    this.state = 'disconnected'
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    if (this.caps) return this.caps
    await this.writeLine(encodeControlLine('GET_CAPABILITIES'))
    await this.delay(250)
    return (
      this.caps ?? {
        protocolVersion: 1,
        channels: ['A0'],
        maxSampleRateHz: 1000,
        resolutions: [14],
        vref: 3.3,
        transportLimits: { maxStreamHz: 1000 },
      }
    )
  }

  async startStream(channel: string, sampleRateHz: number): Promise<void> {
    this.sampleRateHz = sampleRateHz
    await this.writeLine(
      encodeControlLine('SET_SAMPLE_RATE', { hz: sampleRateHz }),
    )
    await this.writeLine(
      encodeControlLine('START_STREAM', { channel, hz: sampleRateHz }),
    )
    this.state = 'streaming'
  }

  async stopStream(): Promise<void> {
    await this.writeLine(encodeControlLine('STOP_STREAM'))
    if (this.state === 'streaming') this.state = 'connected'
  }

  async capture(samples: number, sampleRateHz: number): Promise<SampleBatch> {
    await this.writeLine(
      encodeControlLine('CAPTURE', { samples, hz: sampleRateHz }),
    )
    // Best-effort: wait briefly for frames; if none, throw honest error
    const collected: number[] = []
    const unsub = this.onData((b) => collected.push(...b.volts))
    await this.delay(Math.min(5000, (samples / sampleRateHz) * 1000 + 500))
    unsub()
    if (!collected.length) {
      throw new Error(
        'No physical samples received. Is UNO Q firmware running with Monitor + protocol v1?',
      )
    }
    return {
      volts: collected.slice(0, samples),
      sampleRateHz,
      source: 'physical',
      timestamp: Date.now(),
    }
  }

  onData(listener: TransportListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getConnectionState(): string {
    return this.state
  }

  private async readLoop(): Promise<void> {
    while (this.readLoopActive && this.reader) {
      try {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value) this.ingest(value)
      } catch {
        break
      }
    }
  }

  private ingest(chunk: Uint8Array): void {
    // Split text lines vs binary frames: try binary first when magic present
    const merged = new Uint8Array(this.binBuf.length + chunk.length)
    merged.set(this.binBuf)
    merged.set(chunk, this.binBuf.length)

    const { frames, rest } = decodeFrames(merged)
    this.binBuf = new Uint8Array(rest)
    for (const frame of frames) {
      const volts = countsToVolts(frame.samples, 14, 3.3, 1.5)
      const batch: SampleBatch = {
        volts,
        sampleRateHz: this.sampleRateHz,
        source: 'physical',
        timestamp: Date.now(),
      }
      for (const l of this.listeners) l(batch)
    }

    // Also parse leftover as text for control responses
    const text = new TextDecoder().decode(chunk)
    this.textBuf += text
    const lines = this.textBuf.split('\n')
    this.textBuf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim() || line.includes('\u00c0')) continue
      const { cmd, args } = parseControlLine(line)
      if (cmd === 'CAPABILITIES' || cmd === 'GET_CAPABILITIES') {
        this.caps = parseCapabilities(args)
      }
    }
  }

  private async writeLine(line: string): Promise<void> {
    if (!this.writer) throw new Error('Serial port not connected')
    await this.writer.write(new TextEncoder().encode(line))
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
