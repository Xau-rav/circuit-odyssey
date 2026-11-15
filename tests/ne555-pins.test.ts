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

  it('places DIP-8 horizontally across the channel (template legs)', () => {
    const board = build830Breadboard()
    const project = create555BlinkerProject()
    const u1 = project.circuit.components.find((c) => c.type === 'ne555')!
    const placement = computePlacement(board, u1, 'E5', 0)
    expect(placement).not.toBeNull()
    // Template: flip=false → pins 1–4 on F, pins 5–8 on E
    expect(placement!.pinHoleMap.p1).toBe('F5') // GND
    expect(placement!.pinHoleMap.p2).toBe('F6')
    expect(placement!.pinHoleMap.p3).toBe('F7')
    expect(placement!.pinHoleMap.p4).toBe('F8') // RESET
    expect(placement!.pinHoleMap.p5).toBe('E8') // CONTROL
    expect(placement!.pinHoleMap.p6).toBe('E7')
    expect(placement!.pinHoleMap.p7).toBe('E6')
    expect(placement!.pinHoleMap.p8).toBe('E5') // VCC
  })
})
