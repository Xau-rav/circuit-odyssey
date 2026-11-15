import {
  BOTTOM_ROWS,
  PITCH,
  TOP_ROWS,
  type BreadboardModel,
  isTopRow,
} from '../../breadboard/geometry'
import { getDefinition } from '../../components/library/definitions'
import type {
  ComponentInstance,
  Placement,
  Rotation,
} from '../../core/types'

export function rotateOffset(
  x: number,
  y: number,
  rotation: Rotation,
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x, y }
    case 90:
      return { x: y, y: -x }
    case 180:
      return { x: -x, y: -y }
    case 270:
      return { x: -y, y: x }
  }
}

/**
 * Compute occupied holes and pin→hole map for a DIP or axial part.
 * DIP-8 straddling the channel: anchor is pin-1 hole on the top strip (row E preferred).
 */
export function computePlacement(
  model: BreadboardModel,
  component: ComponentInstance,
  anchorHoleId: string,
  rotation: Rotation = component.rotation,
): Placement | null {
  const def = getDefinition(component.type)
  const anchor = model.holeById.get(anchorHoleId)
  if (!anchor || anchor.region !== 'terminal') return null

  const occupied: string[] = []
  const pinHoleMap: Record<string, string> = {}

  if (def.footprint.straddlesChannel) {
    // Rotation 0 only: pin 1 must be on row E (channel edge).
    // Top: E,D,C,B…  Bottom across channel: F,G,H,I…
    if (rotation !== 0) return null
    if (anchor.row !== 'E') return null
    const half = def.pins.length / 2
    if (half > TOP_ROWS.length || half > BOTTOM_ROWS.length) return null

    for (let i = 0; i < half; i++) {
      const topRow = TOP_ROWS[TOP_ROWS.length - 1 - i]! // E,D,C,B…
      const bottomRow = BOTTOM_ROWS[i]! // F,G,H,I…
      const leftPin = def.pins.find((p) => p.number === i + 1)!
      const rightPin = def.pins.find((p) => p.number === def.pins.length - i)!
      const leftId = `${topRow}${anchor.col}`
      const rightId = `${bottomRow}${anchor.col}`
      if (!model.holeById.has(leftId) || !model.holeById.has(rightId)) return null
      occupied.push(leftId, rightId)
      pinHoleMap[leftPin.id] = leftId
      pinHoleMap[rightPin.id] = rightId
    }
  } else {
    for (const pin of def.pins) {
      const off = rotateOffset(pin.offset.x, pin.offset.y, rotation)
      const col = anchor.col + off.x
      const rowIdx =
        (isTopRow(anchor.row) ? TOP_ROWS : BOTTOM_ROWS).indexOf(
          anchor.row as never,
        ) + off.y
      const rows = isTopRow(anchor.row) ? TOP_ROWS : BOTTOM_ROWS
      if (rowIdx < 0 || rowIdx >= rows.length) return null
      const row = rows[rowIdx]!
      const holeId = `${row}${col}`
      if (!model.holeById.has(holeId)) return null
      occupied.push(holeId)
      pinHoleMap[pin.id] = holeId
    }
  }

  return {
    componentId: component.id,
    anchorHoleId,
    occupiedHoleIds: [...new Set(occupied)],
    pinHoleMap,
  }
}

export function findValidAnchor(
  model: BreadboardModel,
  component: ComponentInstance,
  occupied: Set<string>,
  preferredCol?: number,
): Placement | null {
  const def = getDefinition(component.type)
  const cols = preferredCol
    ? [preferredCol, ...range(1, 63).filter((c) => c !== preferredCol)]
    : range(1, 63)

  if (def.footprint.straddlesChannel) {
    for (const col of cols) {
      const candidate = computePlacement(model, component, `E${col}`, 0)
      if (!candidate) continue
      if (candidate.occupiedHoleIds.some((h) => occupied.has(h))) continue
      return candidate
    }
    return null
  }

  for (const col of cols) {
    for (const row of [...TOP_ROWS, ...BOTTOM_ROWS]) {
      const candidate = computePlacement(model, component, `${row}${col}`, 0)
      if (!candidate) continue
      if (candidate.occupiedHoleIds.some((h) => occupied.has(h))) continue
      return candidate
    }
  }
  return null
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/** Greedy Auto-Set: place IC first, then passives near related nets, power last as rail ties. */
export function autoSetPlacements(
  model: BreadboardModel,
  components: ComponentInstance[],
): Placement[] {
  const occupied = new Set<string>()
  const placements: Placement[] = []

  const order = [...components].sort((a, b) => {
    const score = (c: ComponentInstance) => {
      const def = getDefinition(c.type)
      if (def.footprint.straddlesChannel) return 0
      if (def.category === 'passive' || def.category === 'led') return 1
      if (def.category === 'power') return 3
      return 2
    }
    return score(a) - score(b)
  })

  let icCol = 30
  for (const comp of order) {
    const def = getDefinition(comp.type)
    if (def.category === 'power') {
      // Place VCC/GND as markers on rails near center
      const rail =
        def.type === 'vcc' ? `rail-top+-30` : `rail-top--30`
      const hole = model.holeById.get(rail)
      if (!hole) continue
      const placement: Placement = {
        componentId: comp.id,
        anchorHoleId: hole.id,
        occupiedHoleIds: [hole.id],
        pinHoleMap: { out: hole.id },
      }
      placements.push(placement)
      occupied.add(hole.id)
      continue
    }

    const preferred =
      def.footprint.straddlesChannel
        ? icCol
        : placements[0]
          ? model.holeById.get(placements[0].anchorHoleId)?.col
          : 28
    const placement = findValidAnchor(model, { ...comp, rotation: 0 }, occupied, preferred)
    if (!placement) continue
    placements.push(placement)
    placement.occupiedHoleIds.forEach((h) => occupied.add(h))
    if (def.footprint.straddlesChannel) icCol = (model.holeById.get(placement.anchorHoleId)?.col ?? 30) + 6
  }

  return placements
}

export function placementCenter(
  model: BreadboardModel,
  placement: Placement,
): { x: number; y: number } {
  const pts = placement.occupiedHoleIds
    .map((id) => model.holeById.get(id))
    .filter(Boolean)
  if (!pts.length) return { x: 0, y: 0 }
  const x = pts.reduce((s, h) => s + h!.x, 0) / pts.length
  const y = pts.reduce((s, h) => s + h!.y, 0) / pts.length
  return { x, y }
}

export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) / PITCH + Math.abs(a.y - b.y) / PITCH
}
