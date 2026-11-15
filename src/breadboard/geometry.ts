import type { Hole } from '../core/types'

/** Standard 830-point breadboard geometry (pitch 0.1"). */
export const PITCH = 16
export const HOLE_R = 3.2
export const CHANNEL_GAP = PITCH * 1.2

/** Terminal strip rows: A–E (top) and F–J (bottom), columns 1–63. */
export const TOP_ROWS = ['A', 'B', 'C', 'D', 'E'] as const
export const BOTTOM_ROWS = ['F', 'G', 'H', 'I', 'J'] as const
export const ALL_ROWS = [...TOP_ROWS, ...BOTTOM_ROWS] as const
export const COL_COUNT = 63

/** Power rails are segmented every 5 columns (common 830-point design). */
export const RAIL_SEGMENT_SIZE = 5

export interface BreadboardModel {
  id: string
  holes: Hole[]
  holeById: Map<string, Hole>
  /** Electrically connected hole groups (terminal rows + rail segments). */
  connectivityGroups: Map<string, Set<string>>
}

function railSegmentId(
  rail: 'top+' | 'top-' | 'bottom+' | 'bottom-',
  col: number,
): string {
  const seg = Math.floor((col - 1) / RAIL_SEGMENT_SIZE)
  return `${rail}-seg${seg}`
}

export function build830Breadboard(): BreadboardModel {
  const holes: Hole[] = []
  const holeById = new Map<string, Hole>()
  const connectivityGroups = new Map<string, Set<string>>()

  const ensureGroup = (key: string) => {
    if (!connectivityGroups.has(key)) connectivityGroups.set(key, new Set())
    return connectivityGroups.get(key)!
  }

  // Top power rails (+ then −), above terminal strip
  for (let col = 1; col <= COL_COUNT; col++) {
    for (const [railId, y] of [
      ['top+', PITCH * 0.5] as const,
      ['top-', PITCH * 1.5] as const,
    ]) {
      const id = `rail-${railId}-${col}`
      const seg = railSegmentId(railId, col)
      const hole: Hole = {
        id,
        row: railId,
        col,
        region: 'rail',
        railId,
        railSegmentId: seg,
        x: PITCH * col,
        y,
      }
      holes.push(hole)
      holeById.set(id, hole)
      ensureGroup(seg).add(id)
    }
  }

  const topTerminalY0 = PITCH * 3
  for (let col = 1; col <= COL_COUNT; col++) {
    TOP_ROWS.forEach((row, ri) => {
      const id = `${row}${col}`
      const hole: Hole = {
        id,
        row,
        col,
        region: 'terminal',
        x: PITCH * col,
        y: topTerminalY0 + ri * PITCH,
      }
      holes.push(hole)
      holeById.set(id, hole)
      // Columns are continuous within a letter-row group of 5 (A–E share column)
      ensureGroup(`term-top-${col}`).add(id)
    })
  }

  const bottomTerminalY0 = topTerminalY0 + 5 * PITCH + CHANNEL_GAP
  for (let col = 1; col <= COL_COUNT; col++) {
    BOTTOM_ROWS.forEach((row, ri) => {
      const id = `${row}${col}`
      const hole: Hole = {
        id,
        row,
        col,
        region: 'terminal',
        x: PITCH * col,
        y: bottomTerminalY0 + ri * PITCH,
      }
      holes.push(hole)
      holeById.set(id, hole)
      ensureGroup(`term-bottom-${col}`).add(id)
    })
  }

  // Bottom power rails
  const bottomRailY0 = bottomTerminalY0 + 5 * PITCH + PITCH
  for (let col = 1; col <= COL_COUNT; col++) {
    for (const [railId, y] of [
      ['bottom+', bottomRailY0] as const,
      ['bottom-', bottomRailY0 + PITCH] as const,
    ]) {
      const id = `rail-${railId}-${col}`
      const seg = railSegmentId(railId, col)
      const hole: Hole = {
        id,
        row: railId,
        col,
        region: 'rail',
        railId,
        railSegmentId: seg,
        x: PITCH * col,
        y,
      }
      holes.push(hole)
      holeById.set(id, hole)
      ensureGroup(seg).add(id)
    }
  }

  return {
    id: 'bb-830',
    holes,
    holeById,
    connectivityGroups,
  }
}

export const BOARD_WIDTH = PITCH * (COL_COUNT + 2)
export const BOARD_HEIGHT =
  PITCH * 1.5 + // top rails
  PITCH * 5 +
  CHANNEL_GAP +
  PITCH * 5 +
  PITCH * 3 // bottom rails + padding

export function rowIndex(row: string): number {
  return ALL_ROWS.indexOf(row as (typeof ALL_ROWS)[number])
}

export function isTopRow(row: string): boolean {
  return (TOP_ROWS as readonly string[]).includes(row)
}

export function oppositeChannelRow(row: string): string | null {
  const map: Record<string, string> = {
    E: 'F',
    F: 'E',
    D: 'G',
    G: 'D',
    C: 'H',
    H: 'C',
    B: 'I',
    I: 'B',
    A: 'J',
    J: 'A',
  }
  return map[row] ?? null
}
