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
 * DIP-8 placement matching Breadboard Odyssey template:
 * horizontal across the channel. Anchor = pin-1 column on row E.
 * Template legs(): upper = (pin>=5) !== flip; row E(4) if upper else F(5);
 * offset = pin<=4 ? pin-1 : 8-pin; col = c + (flip ? 3-offset : offset).
 */
export function computePlacement(
  model: BreadboardModel,
  component: ComponentInstance,
  anchorHoleId: string,
  rotation: Rotation = component.rotation,
): Placement | null {
  const def = getDefinition(component.type)
  const anchor = model.holeById.get(anchorHoleId)
  if (!anchor) return null

  const occupied: string[] = []
  const pinHoleMap: Record<string, string> = {}

  if (def.footprint.straddlesChannel) {
    if (anchor.region !== 'terminal' || anchor.row !== 'E') return null
    const flip = rotation === 180 || rotation === 270
    const half = def.pins.length / 2
    if (anchor.col + half - 1 > 63 || anchor.col < 1) return null

    for (const pin of def.pins) {
      const upper = pin.number >= 5 !== flip
      const offset = pin.number <= 4 ? pin.number - 1 : 8 - pin.number
      const col = anchor.col + (flip ? half - 1 - offset : offset)
      const row = upper ? 'E' : 'F'
      const id = `${row}${col}`
      if (!model.holeById.has(id)) return null
      occupied.push(id)
      pinHoleMap[pin.id] = id
    }

    return {
      componentId: component.id,
      anchorHoleId,
      occupiedHoleIds: [...new Set(occupied)],
      pinHoleMap,
    }
  }

  if (def.category === 'power') {
    if (anchor.region !== 'rail') return null
    return {
      componentId: component.id,
      anchorHoleId,
      occupiedHoleIds: [anchorHoleId],
      pinHoleMap: { out: anchorHoleId },
    }
  }

  if (anchor.region !== 'terminal') return null

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
    ? [preferredCol, ...range(1, 60).filter((c) => c !== preferredCol)]
    : range(1, 60)

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

  let icCol = 5
  for (const comp of order) {
    const def = getDefinition(comp.type)
    if (def.category === 'power') {
      const rail = def.type === 'vcc' ? `rail-top+-5` : `rail-top--5`
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

    const icPlacement = placements.find((p) => {
      const c = components.find((x) => x.id === p.componentId)
      return c && getDefinition(c.type).footprint.straddlesChannel
    })
    const preferred = def.footprint.straddlesChannel
      ? icCol
      : icPlacement
        ? model.holeById.get(icPlacement.anchorHoleId)?.col
        : 8

    const placement = findValidAnchor(
      model,
      { ...comp, rotation: 0 },
      occupied,
      preferred,
    )
    if (!placement) continue
    placements.push(placement)
    placement.occupiedHoleIds.forEach((h) => occupied.add(h))
    if (def.footprint.straddlesChannel) {
      icCol = (model.holeById.get(placement.anchorHoleId)?.col ?? 5) + 8
    }
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

export function manhattan(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) / PITCH + Math.abs(a.y - b.y) / PITCH
}
