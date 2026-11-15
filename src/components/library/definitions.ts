import type { ComponentDefinition, PinDef } from '../../core/types'

function dipPins(
  count: number,
  names: string[],
  electrical: Array<PinDef['electrical']>,
): PinDef[] {
  // DIP viewed from above: pin 1 top-left, down left side, then up right side.
  // For DIP-8: left col pins 1–4 (y=0..3), right col pins 8–5 (y=0..3).
  const half = count / 2
  const pins: PinDef[] = []
  for (let i = 0; i < half; i++) {
    const num = i + 1
    pins.push({
      id: `p${num}`,
      name: names[i]!,
      number: num,
      electrical: electrical[i],
      offset: { x: 0, y: i },
    })
  }
  for (let i = 0; i < half; i++) {
    const num = count - i
    const idx = num - 1
    pins.push({
      id: `p${num}`,
      name: names[idx]!,
      number: num,
      electrical: electrical[idx],
      offset: { x: 1, y: i },
    })
  }
  return pins.sort((a, b) => a.number - b.number)
}

/** Canonical NE555 / LM555 DIP-8 pin map (viewed from above). */
export const NE555_DIP8_PINS: PinDef[] = dipPins(
  8,
  ['GND', 'TRIGGER', 'OUTPUT', 'RESET', 'CONTROL', 'THRESHOLD', 'DISCHARGE', 'VCC'],
  ['ground', 'io', 'io', 'io', 'io', 'io', 'io', 'power'],
)

export const COMPONENT_LIBRARY: Record<string, ComponentDefinition> = {
  resistor: {
    type: 'resistor',
    label: 'Resistor',
    category: 'passive',
    package: 'axial-2',
    pins: [
      { id: 'a', name: 'A', number: 1, electrical: 'passive', offset: { x: 0, y: 0 } },
      { id: 'b', name: 'B', number: 2, electrical: 'passive', offset: { x: 1, y: 0 } },
    ],
    footprint: { cols: 2, rows: 1 },
    defaultValue: '1k',
    color: '#ffc174',
  },
  capacitor: {
    type: 'capacitor',
    label: 'Capacitor',
    category: 'passive',
    package: 'ceramic-2',
    pins: [
      { id: 'a', name: 'A', number: 1, electrical: 'passive', offset: { x: 0, y: 0 } },
      { id: 'b', name: 'B', number: 2, electrical: 'passive', offset: { x: 1, y: 0 } },
    ],
    footprint: { cols: 2, rows: 1 },
    defaultValue: '10uF',
    color: '#7bd9ef',
  },
  led: {
    type: 'led',
    label: 'LED',
    category: 'led',
    package: 'led-5mm',
    pins: [
      { id: 'a', name: 'ANODE', number: 1, electrical: 'io', offset: { x: 0, y: 0 } },
      { id: 'k', name: 'CATHODE', number: 2, electrical: 'io', offset: { x: 1, y: 0 } },
    ],
    footprint: { cols: 2, rows: 1 },
    defaultValue: 'RED',
    color: '#ff929b',
  },
  diode: {
    type: 'diode',
    label: 'Diode',
    category: 'diode',
    package: 'axial-2',
    pins: [
      { id: 'a', name: 'ANODE', number: 1, electrical: 'io', offset: { x: 0, y: 0 } },
      { id: 'k', name: 'CATHODE', number: 2, electrical: 'io', offset: { x: 2, y: 0 } },
    ],
    footprint: { cols: 3, rows: 1 },
    defaultValue: '1N4148',
    color: '#f28ad3',
  },
  ne555: {
    type: 'ne555',
    label: '555 Timer',
    category: 'ic',
    package: 'DIP-8',
    pins: NE555_DIP8_PINS,
    footprint: { cols: 2, rows: 4, straddlesChannel: true },
    defaultValue: 'NE555',
    color: '#c5a7ff',
  },
  jumper: {
    type: 'jumper',
    label: 'Jumper',
    category: 'jumper',
    package: 'wire-2',
    pins: [
      { id: 'a', name: 'A', number: 1, electrical: 'passive', offset: { x: 0, y: 0 } },
      { id: 'b', name: 'B', number: 2, electrical: 'passive', offset: { x: 1, y: 0 } },
    ],
    footprint: { cols: 2, rows: 1 },
    color: '#79e3c2',
  },
  vcc: {
    type: 'vcc',
    label: 'VCC Supply',
    category: 'power',
    package: 'power-1',
    pins: [
      { id: 'out', name: 'VCC', number: 1, electrical: 'power', offset: { x: 0, y: 0 } },
    ],
    footprint: { cols: 1, rows: 1 },
    defaultValue: '5V',
    color: '#ff929b',
  },
  gnd: {
    type: 'gnd',
    label: 'GND',
    category: 'power',
    package: 'power-1',
    pins: [
      { id: 'out', name: 'GND', number: 1, electrical: 'ground', offset: { x: 0, y: 0 } },
    ],
    footprint: { cols: 1, rows: 1 },
    color: '#265ac5',
  },
}

export function getDefinition(type: string): ComponentDefinition {
  const def = COMPONENT_LIBRARY[type]
  if (!def) throw new Error(`Unknown component type: ${type}`)
  return def
}

/** Map DIP-8 pin number → canonical 555 function name. */
export function ne555PinName(pinNumber: number): string {
  const pin = NE555_DIP8_PINS.find((p) => p.number === pinNumber)
  if (!pin) throw new Error(`Invalid 555 pin number: ${pinNumber}`)
  return pin.name
}

export function ne555PinNumber(name: string): number {
  const pin = NE555_DIP8_PINS.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  )
  if (!pin) throw new Error(`Invalid 555 pin name: ${name}`)
  return pin.number
}
