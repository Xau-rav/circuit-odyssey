import { analyzeWaveform } from '../analysis'
import type { DeviceCapabilities } from '../../../core/types'
import type { MeasurementTransport, SampleBatch, TransportListener } from './types'

/**
 * Behavioral 555-ish square wave simulator.
 * Always labeled source=simulated — never presented as live hardware.
 */
export class SimTransport implements MeasurementTransport {
  readonly id = 'sim'
  readonly label = 'SimTransport (simulated)'
  readonly source = 'simulated' as const

  private listeners = new Set<TransportListener>()
  private timer: ReturnType<typeof setInterval> | null = null
  private state: 'disconnected' | 'connected' | 'streaming' = 'disconnected'
  private phase = 0
  private faultMode: 'none' | 'missing-reset' = 'none'
  private freqHz = 2.2

  setFaultMode(mode: 'none' | 'missing-reset'): void {
    this.faultMode = mode
  }

  setFrequency(freqHz: number): void {
    this.freqHz = freqHz
  }

  async connect(): Promise<void> {
    this.state = 'connected'
  }

  async disconnect(): Promise<void> {
    await this.stopStream()
    this.state = 'disconnected'
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return {
      protocolVersion: 1,
      channels: ['A0'],
      maxSampleRateHz: 5000,
      resolutions: [12, 14],
      vref: 3.3,
      transportLimits: { maxStreamHz: 5000 },
      simulated: true,
    }
  }

  async startStream(channel: string, sampleRateHz: number): Promise<void> {
    void channel
    this.state = 'streaming'
    if (this.timer) clearInterval(this.timer)
    const chunk = Math.max(16, Math.floor(sampleRateHz / 20))
    this.timer = setInterval(() => {
      const batch = this.synthesize(chunk, sampleRateHz)
      for (const l of this.listeners) l(batch)
    }, 50)
  }

  async stopStream(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.state === 'streaming') this.state = 'connected'
  }

  async capture(samples: number, sampleRateHz: number): Promise<SampleBatch> {
    return this.synthesize(samples, sampleRateHz)
  }

  onData(listener: TransportListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getConnectionState(): string {
    return this.state
  }

  /** Expose analysis helper for Capture & Analyze UI. */
  analyze(volts: number[], sampleRateHz: number) {
    return analyzeWaveform(volts, sampleRateHz)
  }

  private synthesize(count: number, sampleRateHz: number): SampleBatch {
    const volts: number[] = []
    // Missing RESET: 555 held in reset → OUTPUT stuck low (~0 V with LED path)
    if (this.faultMode === 'missing-reset') {
      for (let i = 0; i < count; i++) {
        volts.push(0.02 + Math.random() * 0.01)
        this.phase += 1
      }
    } else {
      const period = sampleRateHz / this.freqHz
      for (let i = 0; i < count; i++) {
        const high = (this.phase % period) < period * 0.5
        volts.push(high ? 4.7 + Math.random() * 0.05 : 0.05 + Math.random() * 0.02)
        this.phase += 1
      }
    }
    return {
      volts,
      sampleRateHz,
      source: 'simulated',
      timestamp: Date.now(),
    }
  }
}
