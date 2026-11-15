import {
  connectedHoles,
  groupKeyForHole,
} from '../../breadboard/connectivity'
import type { BreadboardModel } from '../../breadboard/geometry'
import { getDefinition } from '../../components/library/definitions'
import type {
  ComponentInstance,
  Placement,
  ProjectFile,
  Rotation,
} from '../../core/types'
import { computePlacement } from './index'

export type PlacementValidation =
  | { ok: true; placement: Placement }
  | { ok: false; reason: string }

interface OccupiedPin {
  holeId: string
  componentId: string
  refDes: string
  pinId: string
  netId: string | null
  netName: string
}

function netLabel(
  project: ProjectFile,
  netId: string | null,
): string {
  if (!netId) return '(unconnected)'
  return project.circuit.nets.find((n) => n.id === netId)?.name ?? netId
}

function occupiedPins(
  project: ProjectFile,
  excludeComponentId: string,
): OccupiedPin[] {
  const out: OccupiedPin[] = []
  for (const p of project.breadboard.placements) {
    if (p.componentId === excludeComponentId) continue
    const comp = project.circuit.components.find((c) => c.id === p.componentId)
    if (!comp) continue
    for (const [pinId, holeId] of Object.entries(p.pinHoleMap)) {
      const netId = comp.pins[pinId]?.netId ?? null
      out.push({
        holeId,
        componentId: comp.id,
        refDes: comp.refDes,
        pinId,
        netId,
        netName: netLabel(project, netId),
      })
    }
  }
  return out
}

function anchorHint(
  component: ComponentInstance,
  anchorHoleId: string,
): string {
  const def = getDefinition(component.type)
  if (def.footprint.straddlesChannel) {
    return 'Place the DIP on row E (channel edge), with room for 4 columns.'
  }
  if (def.category === 'power') {
    return 'Place the supply on a power rail (+/−).'
  }
  if (!/^[A-J]\d+$/.test(anchorHoleId) && !anchorHoleId.startsWith('rail-')) {
    return 'Choose an anchor hole on the breadboard.'
  }
  return 'Choose a valid terminal hole for this part.'
}

/**
 * Template-faithful placement validation:
 * - invalid footprint/anchor
 * - "{hole} already has a leg."
 * - "Short blocked: NET_A and NET_B share a connected strip at {hole}."
 */
export function validatePlacementAttempt(
  model: BreadboardModel,
  project: ProjectFile,
  component: ComponentInstance,
  anchorHoleId: string,
  rotation: Rotation = component.rotation,
): PlacementValidation {
  const placement = computePlacement(model, component, anchorHoleId, rotation)
  if (!placement) {
    return { ok: false, reason: anchorHint(component, anchorHoleId) }
  }

  const occupied = occupiedPins(project, component.id)
  const byHole = new Map(occupied.map((o) => [o.holeId, o]))

  for (const [pinId, holeId] of Object.entries(placement.pinHoleMap)) {
    const myNetId = component.pins[pinId]?.netId ?? null
    const myNet = netLabel(project, myNetId)

    const sameHole = byHole.get(holeId)
    if (sameHole) {
      return {
        ok: false,
        reason: `${holeId} already has a leg.`,
      }
    }

    // Any other leg on the same breadboard strip with a different net → short
    const strip = connectedHoles(model, holeId)
    for (const other of occupied) {
      if (!strip.has(other.holeId)) continue
      // Unconnected pins don't create named shorts; still block physical overlap only
      if (myNetId == null || other.netId == null) continue
      if (myNetId === other.netId) continue
      const stripKey = groupKeyForHole(model, holeId) ?? holeId
      return {
        ok: false,
        reason: `Short blocked: ${myNet} and ${other.netName} share a connected strip at ${holeId} (${stripKey}).`,
      }
    }
  }

  return { ok: true, placement }
}
