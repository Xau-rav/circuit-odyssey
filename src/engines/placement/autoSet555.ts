import { connectedHoles } from '../../breadboard/connectivity'
import type { BreadboardModel } from '../../breadboard/geometry'
import type {
  CircuitModel,
  ComponentInstance,
  Placement,
} from '../../core/types'
import { computePlacement } from './index'

/**
 * Textbook 555 astable breadboard recipe (horizontal DIP).
 *
 * U1 @ E6:
 *   E6 VCC, E7 DISCH, E8 THRESH, E9 CTRL
 *   F6 GND, F7 TRIG, F8 OUT, F9 RESET
 *
 * Timing on top strips; LED on bottom/output; supplies on top rails at col 6.
 * GND is always a bottom-strip hole (F–J), never A–E of a power column.
 */
export function autoSet555Demo(
  model: BreadboardModel,
  circuit: CircuitModel,
): Placement[] | null {
  const { components, nets } = circuit
  const u1 = components.find((c) => c.type === 'ne555')
  if (!u1) return null

  const byRef = (ref: string) => components.find((c) => c.refDes === ref)
  const netName = (id: string | null) =>
    id ? (nets.find((n) => n.id === id)?.name ?? id) : '(unconnected)'

  const placements: Placement[] = []
  let scratchPlacements: Placement[] = []

  const validateExplicit = (
    comp: ComponentInstance,
    placement: Placement,
  ): boolean => {
    const occupied: Array<{ holeId: string; netId: string | null; netName: string }> =
      []
    for (const p of scratchPlacements) {
      const other = components.find((c) => c.id === p.componentId)
      if (!other) continue
      for (const [pinId, holeId] of Object.entries(p.pinHoleMap)) {
        const netId = other.pins[pinId]?.netId ?? null
        occupied.push({ holeId, netId, netName: netName(netId) })
      }
    }

    for (const [pinId, holeId] of Object.entries(placement.pinHoleMap)) {
      if (!model.holeById.has(holeId)) return false
      const myNetId = comp.pins[pinId]?.netId ?? null
      if (occupied.some((o) => o.holeId === holeId)) return false
      const strip = connectedHoles(model, holeId)
      for (const other of occupied) {
        if (!strip.has(other.holeId)) continue
        if (myNetId == null || other.netId == null) continue
        if (myNetId === other.netId) continue
        return false
      }
    }
    return true
  }

  const commit = (comp: ComponentInstance, placement: Placement): boolean => {
    if (!validateExplicit(comp, placement)) return false
    placements.push(placement)
    scratchPlacements = [...scratchPlacements, placement]
    return true
  }

  const placeComputed = (comp: ComponentInstance | undefined, anchor: string) => {
    if (!comp) return false
    const p = computePlacement(model, { ...comp, rotation: 0 }, anchor, 0)
    return p ? commit(comp, p) : false
  }

  const placePins = (
    comp: ComponentInstance | undefined,
    pinHoleMap: Record<string, string>,
    anchorHoleId: string,
  ) => {
    if (!comp) return false
    return commit(comp, {
      componentId: comp.id,
      anchorHoleId,
      occupiedHoleIds: [...new Set(Object.values(pinHoleMap))],
      pinHoleMap,
    })
  }

  if (!placeComputed(u1, 'E6')) return null

  placeComputed(byRef('VCC'), 'rail-top+-6')
  placeComputed(byRef('GND'), 'rail-top--6')

  // Timing (top side)
  if (!placePins(byRef('R1'), { a: 'A6', b: 'A7' }, 'A6')) return null
  if (!placePins(byRef('R2'), { a: 'B7', b: 'B8' }, 'B7')) return null
  // C1 THRESH (C8) ↔ GND bottom (G6) — never use A–E col6 (that's VCC)
  if (!placePins(byRef('C1'), { a: 'C8', b: 'G6' }, 'C8')) return null
  // C2 CTRL (D9) ↔ GND (J6)
  if (!placePins(byRef('C2'), { a: 'D9', b: 'J6' }, 'D9')) return null

  // LED path (OUT = F8 / G8 strip)
  if (!placePins(byRef('R3'), { a: 'G8', b: 'G11' }, 'G8')) return null
  if (!placePins(byRef('D1'), { a: 'H11', k: 'H6' }, 'H11')) return null

  const jReset = byRef('J_RESET')
  if (jReset) {
    // RESET strip I9 ↔ VCC strip B6
    if (!placePins(jReset, { a: 'I9', b: 'B6' }, 'I9')) return null
  }

  return placements
}
