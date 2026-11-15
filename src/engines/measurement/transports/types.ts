import type { DeviceCapabilities, MeasurementSource } from '../../../core/types'

export interface SampleBatch {
  volts: number[]
  sampleRateHz: number
  source: MeasurementSource
  timestamp: number
}

export type TransportListener = (batch: SampleBatch) => void

export interface MeasurementTransport {
  readonly id: string
  readonly label: string
  readonly source: MeasurementSource
  connect(): Promise<void>
  disconnect(): Promise<void>
  getCapabilities(): Promise<DeviceCapabilities>
  startStream(channel: string, sampleRateHz: number): Promise<void>
  stopStream(): Promise<void>
  capture(samples: number, sampleRateHz: number): Promise<SampleBatch>
  onData(listener: TransportListener): () => void
  getConnectionState(): string
}
