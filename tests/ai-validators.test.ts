import { describe, expect, it } from 'vitest'
import { validateToolCall } from '../src/engines/ai/tools'

describe('AI tool validators', () => {
  it('rejects unknown tools and raw serial args', () => {
    expect(validateToolCall('emit_serial', {}).ok).toBe(false)
    expect(
      validateToolCall('get_circuit_context', { raw_serial: 'HELLO' }).ok,
    ).toBe(false)
  })

  it('rejects unsafe probe voltages', () => {
    expect(
      validateToolCall('request_probe_measurement', { maxVolts: 12 }).ok,
    ).toBe(false)
    expect(
      validateToolCall('request_probe_measurement', { maxVolts: 5 }).ok,
    ).toBe(true)
  })
})
