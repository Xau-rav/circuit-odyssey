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

/** Validate a placement against occupied holes (excluding this component). */
export function isPlacementFree(
  placement: Placement,
  occupied: Set<string>,
): boolean {
  return !placement.occupiedHoleIds.some((h) => occupied.has(h))
}

export function findValidAnchor(
  model: BreadboardModel,
  component: ComponentInstance,
  occupied: Set<string>,
  preferredCol?: number,
): Placement | null {
  const def = getDefinition(component.type)
  const cols = preferredCol
    ? [
        preferredCol,
        preferredCol + 1,
        preferredCol - 1,
        preferredCol + 2,
        preferredCol - 2,
        ...range(1, 28).filter(
          (c) => Math.abs(c - preferredCol) > 2,
        ),
      ]
    : range(1, 28)

  if (def.category === 'power') {
    for (const col of cols) {
      for (const rail of ['top+', 'top-', 'bottom+', 'bottom-'] as const) {
        const id = `rail-${rail}-${col}`
        const candidate = computePlacement(model, component, id, 0)
        if (!candidate) continue
        if (!isPlacementFree(candidate, occupied)) continue
        return candidate
      }
    }
    return null
  }

  if (def.footprint.straddlesChannel) {
    for (const col of cols) {
      if (col < 1 || col > 27) continue
      const candidate = computePlacement(model, component, `E${col}`, 0)
      if (!candidate) continue
      if (!isPlacementFree(candidate, occupied)) continue
      return candidate
    }
    return null
  }

  // Prefer rows away from channel clutter for passives, but near preferred col
  const rowOrder =
    def.category === 'led' || def.category === 'diode'
      ? (['G', 'H', 'I', 'J', 'A', 'B', 'C', 'D'] as const)
      : (['A', 'B', 'C', 'D', 'G', 'H', 'I', 'J'] as const)

  for (const col of cols) {
    for (const row of rowOrder) {
      for (const rot of [0, 180] as Rotation[]) {
        const candidate = computePlacement(
          model,
          { ...component, rotation: rot },
          `${row}${col}`,
          rot,
        )
        if (!candidate) continue
        if (!isPlacementFree(candidate, occupied)) continue
        return candidate
      }
    }
  }
  return null
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/**
 * Curated 555 astable layout (template-faithful horizontal DIP).
 * U1 @ E8 → VCC/DISCH/THRESH/CTRL on E8–E11, GND/TRIG/OUT/RESET on F8–F11.
 */
function autoSet555Demo(
  model: BreadboardModel,
  components: ComponentInstance[],
): Placement[] | null {
  const byRef = new Map(components.map((c) => [c.refDes, c]))
  const u1 = components.find((c) => c.type === 'ne555')
  if (!u1) return null

  const occupied = new Set<string>()
  const placements: Placement[] = []

  const placeAt = (
    comp: ComponentInstance | undefined,
    anchor: string,
    rotation: Rotation = 0,
  ): boolean => {
    if (!comp) return false
    const p = computePlacement(
      model,
      { ...comp, rotation },
      anchor,
      rotation,
    )
    if (!p || !isPlacementFree(p, occupied)) return false
    placements.push(p)
    p.occupiedHoleIds.forEach((h) => occupied.add(h))
    return true
  }

  // IC first — centered in the visible board
  if (!placeAt(u1, 'E8')) return null

  // Power on top rails at IC columns
  placeAt(byRef.get('VCC'), 'rail-top+-8')
  placeAt(byRef.get('GND'), 'rail-top--8')

  // Timing: R1 VCC↔DISCHARGE uses adjacent strips A8 (VCC/E8) → A9 (DISCH/E9)
  placeAt(byRef.get('R1'), 'A8')
  // R2 DISCHARGE↔THRESHOLD: B9 → B10
  placeAt(byRef.get('R2'), 'B9')
  // C1 THRESH↔GND — sit on thresh strip; wire engine bridges to GND
  placeAt(byRef.get('C1'), 'C10')
  // C2 CONTROL↔GND
  placeAt(byRef.get('C2'), 'D11')
  // LED path on output side (F10 = OUT)
  placeAt(byRef.get('R3'), 'G10')
  placeAt(byRef.get('D1'), 'H10')
  // RESET jumper near RESET (F11) toward VCC side
  placeAt(byRef.get('J_RESET'), 'G11')

  // Any remaining parts: net-aware greedy near IC
  for (const comp of components) {
    if (placements.some((p) => p.componentId === comp.id)) continue
    const near = findValidAnchor(model, comp, occupied, 10)
    if (!near) continue
    placements.push(near)
    near.occupiedHoleIds.forEach((h) => occupied.add(h))
  }

  return placements
}

export function autoSetPlacements(
  model: BreadboardModel,
  components: ComponentInstance[],
): Placement[] {
  const curated = autoSet555Demo(model, components)
  if (curated && curated.length > 0) {
    const essential = components.filter((c) => {
      const def = getDefinition(c.type)
      return def.category !== 'jumper' || c.refDes === 'J_RESET'
    })
    const placedEssential = essential.filter((c) =>
      curated.some((p) => p.componentId === c.id),
    )
    // Accept curated if IC + majority of essentials landed
    if (
      curated.some((p) => {
        const c = components.find((x) => x.id === p.componentId)
        return c?.type === 'ne555'
      }) &&
      placedEssential.length >= Math.ceil(essential.length * 0.6)
    ) {
      return curated
    }
  }

  const occupied = new Set<string>()
  const placements: Placement[] = []

  const order = [...components].sort((a, b) => {
    const score = (c: ComponentInstance) => {
      const def = getDefinition(c.type)
      if (def.footprint.straddlesChannel) return 0
      if (def.category === 'power') return 1
      if (c.refDes === 'R1' || c.refDes === 'R2') return 2
      if (def.category === 'passive') return 3
      if (def.category === 'led' || def.category === 'diode') return 4
      return 5
    }
    return score(a) - score(b)
  })

  let icCol = 8
  for (const comp of order) {
    const def = getDefinition(comp.type)
    const preferred = def.footprint.straddlesChannel
      ? icCol
      : placements[0]
        ? model.holeById.get(placements[0]!.anchorHoleId)?.col ?? icCol
        : icCol

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
      icCol = (model.holeById.get(placement.anchorHoleId)?.col ?? 8) + 6
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
