import type { DeviceCapabilities } from '../../core/types'

export const FRAME_MAGIC_0 = 0xc0
export const FRAME_MAGIC_1 = 0xad

export type ControlCommand =
  | 'HELLO'
  | 'GET_CAPABILITIES'
  | 'GET_STATUS'
  | 'GET_CALIBRATION'
  | 'SET_SAMPLE_RATE'
  | 'START_STREAM'
  | 'STOP_STREAM'
  | 'CAPTURE'

export function encodeControlLine(
  cmd: ControlCommand,
  args: Record<string, string | number> = {},
): string {
  const parts = Object.entries(args).map(([k, v]) => `${k}=${v}`)
  return parts.length ? `${cmd} ${parts.join(' ')}\n` : `${cmd}\n`
}

export function parseControlLine(line: string): {
  cmd: string
  args: Record<string, string>
} {
  const trimmed = line.trim()
  const [cmd, ...rest] = trimmed.split(/\s+/)
  const args: Record<string, string> = {}
  for (const token of rest) {
    const eq = token.indexOf('=')
    if (eq > 0) args[token.slice(0, eq)] = token.slice(eq + 1)
    else args[token] = 'true'
  }
  return { cmd: cmd ?? '', args }
}

export function parseCapabilities(args: Record<string, string>): DeviceCapabilities {
  return {
    protocolVersion: Number(args.protocolVersion ?? 1),
    channels: (args.channels ?? 'A0').split(',').filter(Boolean),
    maxSampleRateHz: Number(args.maxSampleRateHz ?? 1000),
    resolutions: (args.resolutions ?? '12,14').split(',').map(Number),
    vref: Number(args.vref ?? 3.3),
    transportLimits: {
      maxStreamHz: Number(args.maxStreamHz ?? args.maxSampleRateHz ?? 1000),
    },
    simulated: args.simulated === 'true',
  }
}

/** Binary frame: magic | ver | type | seq u16 | flags | count u16 | payload u16[] | crc16 */
export function encodeFrame(
  samples: Uint16Array,
  seq: number,
  flags = 0,
): Uint8Array {
  const count = samples.length
  const buf = new Uint8Array(8 + count * 2 + 2)
  const view = new DataView(buf.buffer)
  buf[0] = FRAME_MAGIC_0
  buf[1] = FRAME_MAGIC_1
  buf[2] = 1 // version
  buf[3] = 1 // type = samples
  view.setUint16(4, seq & 0xffff, true)
  buf[6] = flags
  view.setUint16(7, count, true)
  // Note: offset 7 is awkward; keep payload at 9 for alignment clarity in decoder
  // Re-pack with clearer layout:
  const out = new Uint8Array(10 + count * 2 + 2)
  const v = new DataView(out.buffer)
  out[0] = FRAME_MAGIC_0
  out[1] = FRAME_MAGIC_1
  out[2] = 1
  out[3] = 1
  v.setUint16(4, seq & 0xffff, true)
  out[6] = flags
  out[7] = 0 // reserved
  v.setUint16(8, count, true)
  for (let i = 0; i < count; i++) v.setUint16(10 + i * 2, samples[i]!, true)
  const crc = crc16(out.subarray(0, 10 + count * 2))
  v.setUint16(10 + count * 2, crc, true)
  return out
}

export function decodeFrames(
  buffer: Uint8Array,
): { frames: Array<{ seq: number; flags: number; samples: Uint16Array }>; rest: Uint8Array } {
  const frames: Array<{ seq: number; flags: number; samples: Uint16Array }> = []
  let i = 0
  while (i + 12 <= buffer.length) {
    if (buffer[i] !== FRAME_MAGIC_0 || buffer[i + 1] !== FRAME_MAGIC_1) {
      i += 1
      continue
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset + i)
    const count = view.getUint16(8, true)
    const frameLen = 10 + count * 2 + 2
    if (i + frameLen > buffer.length) break
    const payload = buffer.subarray(i, i + 10 + count * 2)
    const expect = view.getUint16(10 + count * 2, true)
    if (crc16(payload) !== expect) {
      i += 1
      continue
    }
    const samples = new Uint16Array(count)
    for (let s = 0; s < count; s++) samples[s] = view.getUint16(10 + s * 2, true)
    frames.push({
      seq: view.getUint16(4, true),
      flags: buffer[i + 6]!,
      samples,
    })
    i += frameLen
  }
  return { frames, rest: buffer.subarray(i) }
}

export function crc16(data: Uint8Array): number {
  let crc = 0xffff
  for (const b of data) {
    crc ^= b
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1
    }
  }
  return crc & 0xffff
}

export function countsToVolts(
  counts: ArrayLike<number>,
  resolutionBits: number,
  vref: number,
  dividerRatio = 1.5,
  gain = 1,
  offset = 0,
): number[] {
  const full = (1 << resolutionBits) - 1
  const out: number[] = []
  for (let i = 0; i < counts.length; i++) {
    const adcV = (counts[i]! / full) * vref
    out.push((adcV * dividerRatio + offset) * gain)
  }
  return out
}
