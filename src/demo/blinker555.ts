import { createId } from '../core/ids'
import type { ComponentInstance, Net, ProjectFile } from '../core/types'

function pins(...netByPinId: Array<[string, string | null]>): ComponentInstance['pins'] {
  const out: ComponentInstance['pins'] = {}
  for (const [id, netId] of netByPinId) out[id] = { netId }
  return out
}

/**
 * Classic 555 astable LED blinker electrical model.
 * Optional `omitReset` leaves pin 4 unconnected for the Gemini demo fault.
 */
export function create555BlinkerProject(opts?: {
  omitReset?: boolean
}): ProjectFile {
  const net = (name: string, role: Net['role'], expected?: Net['expected']) => {
    const id = createId('net')
    return { id, name, role, expected, pinRefs: [] as Net['pinRefs'] }
  }

  const vcc = net('VCC', 'vcc', { kind: 'dc', approxMean: 5 })
  const gnd = net('GND', 'gnd', { kind: 'dc', approxMean: 0 })
  const output = net('OUTPUT', 'signal', {
    kind: 'square',
    approxFreqHz: 2.2,
    approxVpp: 5,
  })
  const thresh = net('THRESH', 'signal')
  const discharge = net('DISCHARGE', 'signal')
  const control = net('CONTROL', 'signal')
  const reset = net('RESET', 'signal', { kind: 'dc', approxMean: 5 })
  const ledAnode = net('LED_ANODE', 'signal')

  const u1: ComponentInstance = {
    id: createId('comp'),
    type: 'ne555',
    refDes: 'U1',
    value: 'NE555',
    package: 'DIP-8',
    rotation: 0,
    pins: pins(
      ['p1', gnd.id],
      ['p2', thresh.id], // TRIGGER tied to THRESHOLD in astable
      ['p3', output.id],
      ['p4', opts?.omitReset ? null : reset.id],
      ['p5', control.id],
      ['p6', thresh.id],
      ['p7', discharge.id],
      ['p8', vcc.id],
    ),
    status: 'ok',
  }

  const r1: ComponentInstance = {
    id: createId('comp'),
    type: 'resistor',
    refDes: 'R1',
    value: '10k',
    package: 'axial-2',
    rotation: 0,
    pins: pins(['a', vcc.id], ['b', discharge.id]),
    status: 'ok',
  }

  const r2: ComponentInstance = {
    id: createId('comp'),
    type: 'resistor',
    refDes: 'R2',
    value: '100k',
    package: 'axial-2',
    rotation: 0,
    pins: pins(['a', discharge.id], ['b', thresh.id]),
    status: 'ok',
  }

  const r3: ComponentInstance = {
    id: createId('comp'),
    type: 'resistor',
    refDes: 'R3',
    value: '330',
    package: 'axial-2',
    rotation: 0,
    pins: pins(['a', output.id], ['b', ledAnode.id]),
    status: 'ok',
  }

  const c1: ComponentInstance = {
    id: createId('comp'),
    type: 'capacitor',
    refDes: 'C1',
    value: '10uF',
    package: 'ceramic-2',
    rotation: 0,
    pins: pins(['a', thresh.id], ['b', gnd.id]),
    status: 'ok',
  }

  const c2: ComponentInstance = {
    id: createId('comp'),
    type: 'capacitor',
    refDes: 'C2',
    value: '10nF',
    package: 'ceramic-2',
    rotation: 0,
    pins: pins(['a', control.id], ['b', gnd.id]),
    status: 'ok',
  }

  const led1: ComponentInstance = {
    id: createId('comp'),
    type: 'led',
    refDes: 'D1',
    value: 'RED',
    package: 'led-5mm',
    rotation: 0,
    pins: pins(['a', ledAnode.id], ['k', gnd.id]),
    status: 'ok',
  }

  const vccSrc: ComponentInstance = {
    id: createId('comp'),
    type: 'vcc',
    refDes: 'VCC',
    value: '5V',
    package: 'power-1',
    rotation: 0,
    pins: pins(['out', vcc.id]),
    status: 'ok',
  }

  const gndSrc: ComponentInstance = {
    id: createId('comp'),
    type: 'gnd',
    refDes: 'GND',
    value: '0V',
    package: 'power-1',
    rotation: 0,
    pins: pins(['out', gnd.id]),
    status: 'ok',
  }

  // RESET tied to VCC electrically when not omitted
  if (!opts?.omitReset) {
    // Connect reset net to vcc by sharing pin refs via a logical tie:
    // add U1 p4 already on reset; also attach VCC supply net members by merging refs onto vcc
    // Simpler: also put reset pinRefs onto vcc and give RESET a jumper component representation
    // We'll merge: pinRefs for reset include U1.p4; add a jumper from reset to vcc as R_reset
  }

  const jumperReset: ComponentInstance | null = opts?.omitReset
    ? null
    : {
        id: createId('comp'),
        type: 'jumper',
        refDes: 'J_RESET',
        package: 'wire-2',
        rotation: 0,
        pins: pins(['a', reset.id], ['b', vcc.id]),
        status: 'ok',
      }

  const components = [
    u1,
    r1,
    r2,
    r3,
    c1,
    c2,
    led1,
    vccSrc,
    gndSrc,
    ...(jumperReset ? [jumperReset] : []),
  ]

  const nets = [vcc, gnd, output, thresh, discharge, control, reset, ledAnode]

  // Populate pinRefs from components
  for (const c of components) {
    for (const [pinId, state] of Object.entries(c.pins)) {
      if (!state.netId) continue
      const n = nets.find((x) => x.id === state.netId)
      if (n) n.pinRefs.push({ componentId: c.id, pinId })
    }
  }

  return {
    formatVersion: 1,
    name: opts?.omitReset
      ? '555 Astable LED Blinker (RESET fault)'
      : '555 Astable LED Blinker',
    circuit: { components, nets },
    breadboard: {
      modelId: 'bb-830',
      placements: [],
      wires: [],
    },
    assembly: [],
    diagnostics: {
      notes: opts?.omitReset
        ? ['Demo fault: RESET (pin 4) intentionally unconnected']
        : [],
    },
    ui: { mode: 'build' },
  }
}
