import { createId } from '../../core/ids'
import type {
  AssemblyStatus,
  AssemblyStep,
  CircuitModel,
  Placement,
  Wire,
} from '../../core/types'
import { getDefinition } from '../../components/library/definitions'

export function generateAssemblySteps(
  circuit: CircuitModel,
  _placements: Placement[],
  wires: Wire[],
): AssemblyStep[] {
  const byType = (t: string) =>
    circuit.components.filter((c) => c.type === t).map((c) => c.id)

  const steps: AssemblyStep[] = [
    {
      id: createId('step'),
      title: 'Place the 555 timer across the center channel',
      detail: 'Orient notch/pin 1 correctly. Pin 1 = GND (top-left when notch is up).',
      targetIds: byType('ne555'),
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Connect power and ground rails',
      detail: 'Tie VCC/GND supplies and 555 pins 8 (VCC) and 1 (GND). Bridge rail segments if needed.',
      targetIds: [...byType('vcc'), ...byType('gnd')],
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Install timing resistors',
      detail: 'Place Ra/Rb for the astable network (pins 7–6/2).',
      targetIds: circuit.components
        .filter((c) => c.type === 'resistor' && (c.refDes === 'R1' || c.refDes === 'R2'))
        .map((c) => c.id),
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Place the timing capacitor',
      detail: 'Connect timing cap from THRESHOLD/TRIGGER node to GND.',
      targetIds: byType('capacitor'),
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Connect LED and series resistor',
      detail: 'OUTPUT → series R → LED → GND.',
      targetIds: [
        ...circuit.components
          .filter((c) => c.type === 'resistor' && c.refDes === 'R3')
          .map((c) => c.id),
        ...byType('led'),
      ],
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Install remaining jumpers',
      detail: 'RESET→VCC, CONTROL bypass if present, and any remaining net bridges.',
      targetIds: wires.map((w) => w.id),
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Inspect before applying power',
      detail: 'Verify RESET is tied high, polarity of LED, and no power-ground shorts.',
      targetIds: [],
      status: 'pending',
    },
    {
      id: createId('step'),
      title: 'Test the completed circuit',
      detail: 'Enter Debug Mode — use SimTransport or UNO Q Web Serial for measurements.',
      targetIds: [],
      status: 'pending',
    },
  ]

  // Drop empty target steps that have no matching parts (except inspect/test)
  return steps.filter(
    (s, i) => s.targetIds.length > 0 || i >= steps.length - 2,
  )
}

export function setStepStatus(
  steps: AssemblyStep[],
  stepId: string,
  status: AssemblyStatus,
): AssemblyStep[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status } : s))
}

/** When layout changes, flip completed steps whose targets moved to needs_revision. */
export function reviseAffectedSteps(
  steps: AssemblyStep[],
  changedTargetIds: string[],
): AssemblyStep[] {
  const changed = new Set(changedTargetIds)
  return steps.map((s) => {
    if (s.status !== 'completed') return s
    if (s.targetIds.some((id) => changed.has(id))) {
      return { ...s, status: 'needs_revision' }
    }
    return s
  })
}

export function placementLabel(
  circuit: CircuitModel,
  placements: Placement[],
  componentId: string,
): string {
  const c = circuit.components.find((x) => x.id === componentId)
  const p = placements.find((x) => x.componentId === componentId)
  if (!c) return componentId
  const def = getDefinition(c.type)
  return `${c.refDes} (${def.label})${p ? ` @ ${p.anchorHoleId}` : ' — unplaced'}`
}
