import { describe, expect, it } from 'vitest'
import {
  NE555_DIP8_PINS,
  ne555PinName,
  ne555PinNumber,
} from '../src/components/library/definitions'
import { computePlacement } from '../src/engines/placement'
import { build830Breadboard } from '../src/breadboard/geometry'
import { create555BlinkerProject } from '../src/demo/blinker555'

describe('NE555 DIP-8 pin map', () => {
  it('maps canonical pin numbers to names', () => {
    expect(ne555PinName(1)).toBe('GND')
    expect(ne555PinName(2)).toBe('TRIGGER')
    expect(ne555PinName(3)).toBe('OUTPUT')
    expect(ne555PinName(4)).toBe('RESET')
    expect(ne555PinName(5)).toBe('CONTROL')
    expect(ne555PinName(6)).toBe('THRESHOLD')
    expect(ne555PinName(7)).toBe('DISCHARGE')
    expect(ne555PinName(8)).toBe('VCC')
  })

  it('round-trips pin names', () => {
    for (const p of NE555_DIP8_PINS) {
      expect(ne555PinNumber(p.name)).toBe(p.number)
    }
  })

  it('places DIP-8 across the channel with correct physical pin holes', () => {
    const board = build830Breadboard()
    const project = create555BlinkerProject()
    const u1 = project.circuit.components.find((c) => c.type === 'ne555')!
    const placement = computePlacement(board, u1, 'E30', 0)
    expect(placement).not.toBeNull()
    // Pin 1 GND → top strip at anchor column; pin 8 VCC → bottom strip same column
    expect(placement!.pinHoleMap.p1).toBe('E30') // GND
    expect(placement!.pinHoleMap.p8).toBe('F30') // VCC across channel
    expect(placement!.pinHoleMap.p4).toBe('B30') // RESET
    expect(placement!.pinHoleMap.p5).toBe('I30') // CONTROL
  })
})
