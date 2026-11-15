import type { BreadboardModel } from './geometry'

/** True if two holes are shorted by the breadboard itself (same column strip or same rail segment). */
export function holesAreConnected(
  model: BreadboardModel,
  a: string,
  b: string,
): boolean {
  if (a === b) return true
  for (const group of model.connectivityGroups.values()) {
    if (group.has(a) && group.has(b)) return true
  }
  return false
}

/** All holes electrically continuous with `holeId` via breadboard internals (includes self). */
export function connectedHoles(
  model: BreadboardModel,
  holeId: string,
): Set<string> {
  for (const group of model.connectivityGroups.values()) {
    if (group.has(holeId)) return new Set(group)
  }
  return new Set([holeId])
}

/** Find a connectivity group key containing the hole, if any. */
export function groupKeyForHole(
  model: BreadboardModel,
  holeId: string,
): string | null {
  for (const [key, group] of model.connectivityGroups) {
    if (group.has(holeId)) return key
  }
  return null
}

/**
 * Union-find style: expand a set of seed holes through breadboard shorts and jumper wires.
 */
export function expandNetHoles(
  model: BreadboardModel,
  seedHoleIds: string[],
  jumperPairs: Array<{ from: string; to: string }>,
): Set<string> {
  const visited = new Set<string>()
  const queue = [...seedHoleIds]

  const neighbors = new Map<string, Set<string>>()
  const addEdge = (a: string, b: string) => {
    if (!neighbors.has(a)) neighbors.set(a, new Set())
    if (!neighbors.has(b)) neighbors.set(b, new Set())
    neighbors.get(a)!.add(b)
    neighbors.get(b)!.add(a)
  }

  for (const h of model.holes) {
    const group = connectedHoles(model, h.id)
    const arr = [...group]
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) addEdge(arr[i]!, arr[j]!)
    }
  }
  for (const w of jumperPairs) addEdge(w.from, w.to)

  while (queue.length) {
    const id = queue.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const n of neighbors.get(id) ?? []) {
      if (!visited.has(n)) queue.push(n)
    }
  }
  return visited
}
