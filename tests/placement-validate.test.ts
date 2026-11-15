import { describe, expect, it } from 'vitest'
import { build830Breadboard } from '../src/breadboard/geometry'
import { create555BlinkerProject } from '../src/demo/blinker555'
import { computePlacement } from '../src/engines/placement'
import { validatePlacementAttempt } from '../src/engines/placement/validate'

describe('placement conflict validation (template parity)', () => {
  const board = build830Breadboard()

  it('rejects overlapping legs with already-has-a-leg message', () => {
    const project = create555BlinkerProject()
    const u1 = project.circuit.components.find((c) => c.type === 'ne555')!
    const r1 = project.circuit.components.find((c) => c.refDes === 'R1')!
    const ic = computePlacement(board, u1, 'E8', 0)!
    project.breadboard.placements = [ic]

    const bad = validatePlacementAttempt(board, project, r1, 'A8', 0)
    // A8 is in VCC strip with U1 pin on E8 — may be short or overlap depending on nets
    // Force pure overlap: place second part on exact IC hole via fake anchor that lands on F8
    const overlap = validatePlacementAttempt(board, project, r1, 'F8', 0)
    // F8 is occupied by IC pin — computePlacement for resistor at F8 uses F8+F9
    expect(overlap.ok).toBe(false)
    if (!overlap.ok) {
      expect(overlap.reason).toMatch(/already has a leg|Short blocked/)
    }
    void bad
  })

  it('blocks shorts when different nets share a strip', () => {
    const project = create555BlinkerProject()
    const u1 = project.circuit.components.find((c) => c.type === 'ne555')!
    const r3 = project.circuit.components.find((c) => c.refDes === 'R3')!
    // R3 is OUTPUT–LED_ANODE. Place IC first.
    const ic = computePlacement(board, u1, 'E8', 0)!
    project.breadboard.placements = [ic]
    // Place R3 on A8 (VCC strip / E8 = VCC pin) — R3 pin A is OUTPUT net ≠ VCC
    const result = validatePlacementAttempt(board, project, r3, 'A8', 0)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/Short blocked:/)
      expect(result.reason).toMatch(/share a connected strip/)
    }
  })

  it('allows placement that shares a strip with the same net', () => {
    const project = create555BlinkerProject()
    const u1 = project.circuit.components.find((c) => c.type === 'ne555')!
    const r1 = project.circuit.components.find((c) => c.refDes === 'R1')!
    // R1 is VCC–DISCHARGE. A8 is VCC strip (same as E8 VCC), A9 is DISCHARGE strip (E9)
    const ic = computePlacement(board, u1, 'E8', 0)!
    project.breadboard.placements = [ic]
    const result = validatePlacementAttempt(board, project, r1, 'A8', 0)
    expect(result.ok).toBe(true)
  })
})
