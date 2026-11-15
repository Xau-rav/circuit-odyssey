import { getDefinition } from '../components/library/definitions'
import type { ComponentInstance, CircuitModel, Placement } from './types'

export function validateComponentPins(comp: ComponentInstance): string[] {
  const errors: string[] = []
  try {
    const def = getDefinition(comp.type)
    for (const pin of def.pins) {
      if (!(pin.id in comp.pins)) {
        errors.push(`${comp.refDes}: missing pin state for ${pin.name}`)
      }
    }
  } catch (e) {
    errors.push(String(e))
  }
  return errors
}

export function validateCircuit(circuit: CircuitModel): string[] {
  const errors: string[] = []
  const netIds = new Set(circuit.nets.map((n) => n.id))
  for (const c of circuit.components) {
    errors.push(...validateComponentPins(c))
    for (const [pinId, state] of Object.entries(c.pins)) {
      if (state.netId && !netIds.has(state.netId)) {
        errors.push(`${c.refDes}.${pinId}: unknown net ${state.netId}`)
      }
    }
  }
  for (const net of circuit.nets) {
    for (const ref of net.pinRefs) {
      const comp = circuit.components.find((c) => c.id === ref.componentId)
      if (!comp) {
        errors.push(`Net ${net.name ?? net.id}: missing component ${ref.componentId}`)
        continue
      }
      if (!(ref.pinId in comp.pins)) {
        errors.push(`Net ${net.name ?? net.id}: missing pin ${ref.pinId} on ${comp.refDes}`)
      }
    }
  }
  return errors
}

export function placementsOverlap(a: Placement, b: Placement): boolean {
  const setB = new Set(b.occupiedHoleIds)
  return a.occupiedHoleIds.some((h) => setB.has(h))
}
