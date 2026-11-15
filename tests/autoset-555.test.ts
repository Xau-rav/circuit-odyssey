import { describe, expect, it } from 'vitest'
import { build830Breadboard } from '../src/breadboard/geometry'
import { create555BlinkerProject } from '../src/demo/blinker555'
import { autoSetPlacements } from '../src/engines/placement'
import { generateWires } from '../src/engines/routing'
import { generateAssemblySteps } from '../src/engines/assembly'

describe('555 Auto-set demo layout', () => {
  const board = build830Breadboard()

  it('places a clean buildable 555 astable with DIP on E6', () => {
    const project = create555BlinkerProject()
    const placements = autoSetPlacements(board, project.circuit)
    const byId = new Map(
      placements.map((p) => {
        const c = project.circuit.components.find((x) => x.id === p.componentId)!
        return [c.refDes, p] as const
      }),
    )

    expect(byId.get('U1')?.anchorHoleId).toBe('E6')
    expect(byId.get('U1')?.pinHoleMap.p8).toBe('E6') // VCC
    expect(byId.get('U1')?.pinHoleMap.p1).toBe('F6') // GND
    expect(byId.get('VCC')?.anchorHoleId).toBe('rail-top+-6')
    expect(byId.get('GND')?.anchorHoleId).toBe('rail-top--6')
    expect(byId.get('R1')?.pinHoleMap).toMatchObject({ a: 'A6', b: 'A7' })
    expect(byId.get('R2')?.pinHoleMap).toMatchObject({ a: 'B7', b: 'B8' })
    expect(byId.get('C1')?.pinHoleMap).toMatchObject({ a: 'C8', b: 'G6' })
    expect(byId.get('D1')?.pinHoleMap).toMatchObject({ a: 'H11', k: 'H6' })
    expect(byId.get('C2')?.pinHoleMap).toMatchObject({ a: 'D9', b: 'J6' })
    expect(byId.get('J_RESET')?.pinHoleMap).toMatchObject({ a: 'I9', b: 'B6' })
    expect(byId.has('J_RESET')).toBe(true)

    // Sequential validation: no overlaps/shorts
    let scratch = {
      ...project,
      breadboard: { ...project.breadboard, placements: [] as typeof placements },
    }
    for (const p of placements) {
      const comp = project.circuit.components.find((c) => c.id === p.componentId)!
      // Use validate on computed anchors where possible; for explicit, place then check occupancy
      const occupied = new Set(
        scratch.breadboard.placements.flatMap((x) => x.occupiedHoleIds),
      )
      expect(p.occupiedHoleIds.some((h) => occupied.has(h))).toBe(false)
      scratch = {
        ...scratch,
        breadboard: {
          ...scratch.breadboard,
          placements: [...scratch.breadboard.placements, p],
        },
      }
    }

    const wires = generateWires(board, project.circuit, placements, [])
    expect(wires.filter((w) => w.valid).length).toBeGreaterThan(0)

    const steps = generateAssemblySteps(
      project.circuit,
      placements,
      wires,
    )
    expect(steps.length).toBeGreaterThan(3)
  })

  it('still places core parts when RESET jumper is omitted (fault demo)', () => {
    const project = create555BlinkerProject({ omitReset: true })
    const placements = autoSetPlacements(board, project.circuit)
    const refs = new Set(
      placements.map(
        (p) =>
          project.circuit.components.find((c) => c.id === p.componentId)!.refDes,
      ),
    )
    expect(refs.has('U1')).toBe(true)
    expect(refs.has('R1')).toBe(true)
    expect(refs.has('D1')).toBe(true)
    expect(refs.has('J_RESET')).toBe(false)
  })
})
