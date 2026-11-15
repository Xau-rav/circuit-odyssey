export type Id = string
export type Rotation = 0 | 90 | 180 | 270
export type ElectricalRole = 'power' | 'ground' | 'io' | 'passive' | 'unknown'
export type NetRole = 'vcc' | 'gnd' | 'signal' | 'unknown'
export type AssemblyStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_revision'
  | 'blocked'
export type WireAssemblyStatus = 'pending' | 'placed' | 'needs-revision'
export type MeasurementSource = 'physical' | 'simulated' | 'user' | 'ai_prediction'
export type AppMode = 'build' | 'debug'
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error'
  | 'unsupported'

export interface PinDef {
  id: Id
  name: string
  number: number
  electrical?: ElectricalRole
  /** Offset in pin-pitch units relative to package anchor (pin 1). */
  offset: { x: number; y: number }
}

export interface ComponentDefinition {
  type: string
  label: string
  category: 'passive' | 'diode' | 'led' | 'ic' | 'jumper' | 'power'
  package: string
  pins: PinDef[]
  /** Footprint span in holes (width × height across breadboard). */
  footprint: { cols: number; rows: number; straddlesChannel?: boolean }
  defaultValue?: string
  color: string
}

export interface ComponentPinState {
  netId: Id | null
}

export interface ComponentInstance {
  id: Id
  type: string
  refDes: string
  value?: string
  model?: string
  package: string
  rotation: Rotation
  pins: Record<Id, ComponentPinState>
  placement?: { anchorHoleId: Id }
  status: 'ok' | 'invalid' | 'missing-model'
}

export interface PinRef {
  componentId: Id
  pinId: Id
}

export interface ExpectedBehavior {
  kind: 'dc' | 'square' | 'unknown'
  approxFreqHz?: number
  approxVpp?: number
  approxMean?: number
  notes?: string
}

export interface Net {
  id: Id
  name?: string
  pinRefs: PinRef[]
  role?: NetRole
  expected?: ExpectedBehavior
}

export type HoleRegion = 'terminal' | 'rail' | 'other'

export interface Hole {
  id: Id
  row: string
  col: number
  region: HoleRegion
  /** Power rail side: top+/top-/bottom+/bottom- */
  railId?: 'top+' | 'top-' | 'bottom+' | 'bottom-'
  railSegmentId?: Id
  x: number
  y: number
}

export interface Point {
  x: number
  y: number
}

export interface Wire {
  id: Id
  netId: Id
  fromHoleId: Id
  toHoleId: Id
  color: string
  path: Point[]
  valid: boolean
  assembly?: WireAssemblyStatus
}

export interface Placement {
  componentId: Id
  anchorHoleId: Id
  occupiedHoleIds: Id[]
  pinHoleMap: Record<Id, Id>
}

export interface AssemblyStep {
  id: Id
  title: string
  detail?: string
  targetIds: Id[]
  status: AssemblyStatus
}

export interface MeasurementStats {
  mean: number
  min: number
  max: number
  pp: number
  rms?: number
  freqHz?: number
  freqConfidence?: number
}

export interface MeasurementReport {
  id: Id
  projectId: Id
  netId?: Id
  componentId?: Id
  pinId?: Id
  holeId?: Id
  reference: 'gnd'
  source: MeasurementSource
  adc: { resolutionBits: number; vref: number; channel: string }
  sampleRateHz: number
  startedAt: string
  calibration?: { gain: number; offset: number; dividerRatio: number }
  stats: MeasurementStats
  samples?: number[]
  quality: { droppedSamples: number; clipping: boolean; notes?: string[] }
}

export interface CircuitModel {
  components: ComponentInstance[]
  nets: Net[]
}

export interface BreadboardLayout {
  modelId: string
  placements: Placement[]
  wires: Wire[]
}

export interface ProjectFile {
  formatVersion: 1
  name: string
  circuit: CircuitModel
  breadboard: BreadboardLayout
  assembly: AssemblyStep[]
  diagnostics?: { notes?: string[] }
  ui?: { mode?: AppMode }
}

export interface DeviceCapabilities {
  protocolVersion: number
  channels: string[]
  maxSampleRateHz: number
  resolutions: number[]
  vref: number
  transportLimits?: { maxStreamHz: number }
  simulated?: boolean
}
