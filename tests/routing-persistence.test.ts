import { describe, expect, it } from 'vitest'
import { build830Breadboard } from '../src/breadboard/geometry'
import { create555BlinkerProject } from '../src/demo/blinker555'
import { autoSetPlacements } from '../src/engines/placement'
import {
  fitWires,
  generateWires,
  markAffectedWires,
} from '../src/engines/routing'

describe('routing persistence', () => {
  const board = build830Breadboard()

  it('generates wires for 555 nets after Auto-Set', () => {
    const project = create555BlinkerProject()
    const placements = autoSetPlacements(board, project.circuit.components)
    expect(placements.length).toBeGreaterThan(0)
    const wires = generateWires(board, project.circuit, placements, [])
    expect(wires.some((w) => w.valid)).toBe(true)
  })

  it('marks only affected wires on move and Fit Wires restores links', () => {
    const project = create555BlinkerProject()
    const placements = autoSetPlacements(board, project.circuit.components)
    let wires = generateWires(board, project.circuit, placements, [])
    expect(wires.length).toBeGreaterThan(0)
    const sample = wires.find((w) => w.valid)!
    wires = markAffectedWires(wires, [sample.fromHoleId, sample.toHoleId])
    expect(wires.some((w) => w.assembly === 'needs-revision')).toBe(true)

    const fitted = fitWires(board, project.circuit, placements, wires)
    expect(fitted.some((w) => w.valid)).toBe(true)
  })
})
