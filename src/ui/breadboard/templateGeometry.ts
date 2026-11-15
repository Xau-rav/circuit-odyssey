/** Pixel layout from Breadboard Odyssey template (visual only). */
export const VIS_COLS = 30
export const VIS_ROWS = 'ABCDEFGHIJ'
export const RAIL_LABELS = ['T+', 'T−', 'B+', 'B−'] as const

/** Template y positions for rows A–J then rails T+,T−,B+,B− */
const Y = [107, 132, 157, 182, 207, 275, 313, 338, 363, 388, 30, 53, 418, 443]

export function holeX(col: number): number {
  return 54 + (col - 1) * 38
}

export function holeY(rowIndex: number): number {
  return Y[rowIndex] ?? 0
}

export function terminalRowIndex(row: string): number {
  return VIS_ROWS.indexOf(row)
}

export function railRowIndex(railId: string): number | null {
  const map: Record<string, number> = {
    'top+': 10,
    'top-': 11,
    'bottom+': 12,
    'bottom-': 13,
  }
  return map[railId] ?? null
}

/** Parse our hole id (E5, rail-top+-3, …) into template pixel center. */
export function holePixel(
  holeId: string,
): { x: number; y: number; label: string } | null {
  const rail = /^rail-(top\+|top-|bottom\+|bottom-)-(\d+)$/.exec(holeId)
  if (rail) {
    const ri = railRowIndex(rail[1]!)
    const col = Number(rail[2])
    if (ri == null || col < 1 || col > VIS_COLS) return null
    return { x: holeX(col), y: holeY(ri), label: holeId }
  }
  const m = /^([A-J])(\d+)$/.exec(holeId)
  if (!m) return null
  const ri = terminalRowIndex(m[1]!)
  const col = Number(m[2])
  if (ri < 0 || col < 1 || col > VIS_COLS) return null
  return { x: holeX(col), y: holeY(ri), label: holeId }
}

export const BOARD_PX_W = holeX(VIS_COLS) + 40
export const BOARD_PX_H = 468
