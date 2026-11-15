import { connectedHoles } from '../../breadboard/connectivity'
import type { BreadboardModel } from '../../breadboard/geometry'
import { createId } from '../../core/ids'
import type { CircuitModel, Net, Placement, Point, Wire } from '../../core/types'

const NET_COLORS: Record<string, string> = {
  vcc: '#dc2626',
  gnd: '#1f2937',
  signal: '#0d9488',
  unknown: '#2563eb',
}

export function wireColorForNet(net: Net): string {
  return NET_COLORS[net.role ?? 'unknown'] ?? NET_COLORS.unknown!
}

function holePoint(model: BreadboardModel, holeId: string): Point {
  const h = model.holeById.get(holeId)!
  return { x: h.x, y: h.y }
}

function manhattanPath(a: Point, b: Point): Point[] {
  if (a.x === b.x || a.y === b.y) return [a, b]
  return [a, { x: b.x, y: a.y }, b]
}

/** Pick a free hole in the same breadboard group as `preferred`, not in occupied. */
function pickHoleInGroup(
  model: BreadboardModel,
  seedHoleId: string,
  occupied: Set<string>,
  preferSame: boolean,
): string | null {
  const group = [...connectedHoles(model, seedHoleId)]
  if (preferSame && !occupied.has(seedHoleId)) return seedHoleId
  for (const id of group) {
    if (!occupied.has(id)) return id
  }
  return preferSame ? seedHoleId : null
}

function pinHole(
  placements: Placement[],
  componentId: string,
  pinId: string,
): string | null {
  const p = placements.find((x) => x.componentId === componentId)
  return p?.pinHoleMap[pinId] ?? null
}

/**
 * Generate jumper wires for nets that need bridging between non-shorted pin holes.
 * Skips connections already completed by breadboard column/rail continuity.
 */
export function generateWires(
  model: BreadboardModel,
  circuit: CircuitModel,
  placements: Placement[],
  existing: Wire[] = [],
): Wire[] {
  const occupied = new Set<string>()
  for (const p of placements) p.occupiedHoleIds.forEach((h) => occupied.add(h))
  for (const w of existing) {
    if (w.valid) {
      occupied.add(w.fromHoleId)
      occupied.add(w.toHoleId)
    }
  }

  const wires: Wire[] = [...existing.filter((w) => w.valid)]
  const coveredPairs = new Set(
    wires.map((w) => edgeKey(w.fromHoleId, w.toHoleId)),
  )

  for (const net of circuit.nets) {
    const holes: string[] = []
    for (const ref of net.pinRefs) {
      const h = pinHole(placements, ref.componentId, ref.pinId)
      if (h) holes.push(h)
    }
    if (holes.length < 2) continue

    // Union-find across breadboard shorts + existing wires for this net
    const parent = new Map<string, string>()
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x)
      const p = parent.get(x)!
      if (p !== x) parent.set(x, find(p))
      return parent.get(x)!
    }
    const union = (a: string, b: string) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent.set(ra, rb)
    }

    for (const h of holes) {
      for (const g of connectedHoles(model, h)) union(h, g)
    }
    for (const w of wires) {
      if (w.netId === net.id) union(w.fromHoleId, w.toHoleId)
    }

    // Connect components of the forest with new jumpers
    const roots = new Map<string, string>()
    for (const h of holes) {
      const r = find(h)
      if (!roots.has(r)) roots.set(r, h)
    }
    const reps = [...roots.values()]
    for (let i = 1; i < reps.length; i++) {
      const fromSeed = reps[0]!
      const toSeed = reps[i]!
      const from =
        pickHoleInGroup(model, fromSeed, occupied, true) ?? fromSeed
      const to = pickHoleInGroup(model, toSeed, occupied, true) ?? toSeed
      const key = edgeKey(from, to)
      if (coveredPairs.has(key)) continue
      const wire: Wire = {
        id: createId('wire'),
        netId: net.id,
        fromHoleId: from,
        toHoleId: to,
        color: wireColorForNet(net),
        path: manhattanPath(holePoint(model, from), holePoint(model, to)),
        valid: true,
        assembly: 'pending',
      }
      wires.push(wire)
      coveredPairs.add(key)
      occupied.add(from)
      occupied.add(to)
      union(from, to)
    }
  }

  return wires
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * After moves: keep wires whose endpoints still land on the same net's pin groups;
 * mark others needs-revision; regenerate missing links.
 */
export function fitWires(
  model: BreadboardModel,
  circuit: CircuitModel,
  placements: Placement[],
  wires: Wire[],
): Wire[] {
  const stillValid: Wire[] = []
  for (const w of wires) {
    const net = circuit.nets.find((n) => n.id === w.netId)
    if (!net) {
      stillValid.push({ ...w, valid: false, assembly: 'needs-revision' })
      continue
    }
    const pinHoles = net.pinRefs
      .map((r) => pinHole(placements, r.componentId, r.pinId))
      .filter((x): x is string => !!x)

    const fromOk = pinHoles.some(
      (h) =>
        h === w.fromHoleId ||
        connectedHoles(model, h).has(w.fromHoleId),
    )
    const toOk = pinHoles.some(
      (h) =>
        h === w.toHoleId || connectedHoles(model, h).has(w.toHoleId),
    )
    if (fromOk && toOk) {
      stillValid.push({
        ...w,
        valid: true,
        path: manhattanPath(
          holePoint(model, w.fromHoleId),
          holePoint(model, w.toHoleId),
        ),
      })
    } else {
      stillValid.push({ ...w, valid: false, assembly: 'needs-revision' })
    }
  }

  const validOnly = stillValid.filter((w) => w.valid)
  const regenerated = generateWires(model, circuit, placements, validOnly)
  // Preserve invalid markers for assembly UX
  const invalid = stillValid.filter((w) => !w.valid)
  return [...regenerated, ...invalid]
}

/** Mark wires touching a moved component's old/new holes as needing revision. */
export function markAffectedWires(
  wires: Wire[],
  affectedHoleIds: string[],
): Wire[] {
  const set = new Set(affectedHoleIds)
  return wires.map((w) =>
    set.has(w.fromHoleId) || set.has(w.toHoleId)
      ? { ...w, valid: false, assembly: 'needs-revision' as const }
      : w,
  )
}
