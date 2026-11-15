import { useEffect, useMemo, useState } from 'react'
import { getDefinition } from '../../components/library/definitions'
import { validatePlacementAttempt } from '../../engines/placement/validate'
import { useStore } from '../../state/store'
import {
  BOARD_PX_H,
  BOARD_PX_W,
  RAIL_LABELS,
  VIS_COLS,
  VIS_ROWS,
  holePixel,
  holeX,
  holeY,
  terminalRowIndex,
} from './templateGeometry'

export function BreadboardBoard({
  showProbe = false,
  showProposed = true,
}: {
  showProbe?: boolean
  showProposed?: boolean
}) {
  const project = useStore((s) => s.project)
  const board = useStore((s) => s.board)
  const selectedIds = useStore((s) => s.selectedIds)
  const highlightedIds = useStore((s) => s.highlightedIds)
  const probeTarget = useStore((s) => s.probeTarget)
  const showWires = useStore((s) => s.showWires)
  const dragComponentId = useStore((s) => s.dragComponentId)
  const select = useStore((s) => s.select)
  const moveComponent = useStore((s) => s.moveComponent)
  const setDragComponentId = useStore((s) => s.setDragComponentId)
  const setBoardStatus = useStore((s) => s.setBoardStatus)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const [previewAnchor, setPreviewAnchor] = useState<string | null>(null)

  const heldId = dragComponentId ?? null

  const heldComp = heldId
    ? project.circuit.components.find((c) => c.id === heldId) ?? null
    : null

  const projectForPreview = useMemo(() => {
    if (!heldId) return project
    return {
      ...project,
      breadboard: {
        ...project.breadboard,
        placements: project.breadboard.placements.filter(
          (p) => p.componentId !== heldId,
        ),
      },
    }
  }, [project, heldId])

  const preview = useMemo(() => {
    if (!heldComp || !previewAnchor) return null
    const result = validatePlacementAttempt(
      board,
      projectForPreview,
      heldComp,
      previewAnchor,
      heldComp.rotation,
    )
    if (!result.ok) {
      return { valid: false as const, holes: [previewAnchor], reason: result.reason }
    }
    return {
      valid: true as const,
      holes: result.placement.occupiedHoleIds,
      reason: null as string | null,
    }
  }, [heldComp, previewAnchor, board, projectForPreview])

  const validAnchors = useMemo(() => {
    if (!heldComp) return new Set<string>()
    const out = new Set<string>()
    const def = getDefinition(heldComp.type)
    const tryId = (id: string) => {
      const r = validatePlacementAttempt(
        board,
        projectForPreview,
        heldComp,
        id,
        heldComp.rotation,
      )
      if (r.ok) out.add(id)
    }
    if (def.footprint.straddlesChannel) {
      for (let c = 1; c <= VIS_COLS - 3; c++) tryId(`E${c}`)
    } else if (def.category === 'power') {
      for (const rail of ['top+', 'top-', 'bottom+', 'bottom-'] as const) {
        for (let c = 1; c <= VIS_COLS; c++) tryId(`rail-${rail}-${c}`)
      }
    } else {
      for (const row of VIS_ROWS) {
        for (let c = 1; c <= VIS_COLS; c++) tryId(`${row}${c}`)
      }
    }
    return out
  }, [heldComp, board, projectForPreview])

  useEffect(() => {
    if (!heldComp) return
    if (preview?.reason) {
      setBoardStatus(preview.reason, true)
    } else if (heldId) {
      setBoardStatus(
        `Holding ${heldComp.refDes}. Drop on an outlined anchor.`,
        false,
      )
    }
  }, [preview, heldComp, heldId, setBoardStatus])

  const pinAt = useMemo(() => {
    const m = new Map<
      string,
      { componentId: string; pinId: string; color: string; num: number; refDes: string }
    >()
    for (const p of project.breadboard.placements) {
      const comp = project.circuit.components.find((c) => c.id === p.componentId)
      if (!comp) continue
      const def = getDefinition(comp.type)
      for (const [pinId, holeId] of Object.entries(p.pinHoleMap)) {
        const pin = def.pins.find((x) => x.id === pinId)
        if (!pin) continue
        m.set(holeId, {
          componentId: comp.id,
          pinId,
          color: def.color,
          num: pin.number,
          refDes: comp.refDes,
        })
      }
    }
    return m
  }, [project])

  const tryPlace = (holeId: string) => {
    const id = heldId ?? selectedIds[0]
    if (!id) return
    moveComponent(id, holeId)
    setDragComponentId(null)
    setPreviewAnchor(null)
  }

  const onHoleDragOver = (e: React.DragEvent, holeId: string) => {
    if (!heldId && !e.dataTransfer.types.includes('text/plain')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setPreviewAnchor(holeId)
  }

  const onHoleDrop = (e: React.DragEvent, holeId: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || heldId
    if (id) {
      setDragComponentId(id)
      moveComponent(id, holeId)
    }
    setDragComponentId(null)
    setPreviewAnchor(null)
  }

  const holeClass = (holeId: string) => {
    const classes = ['hole']
    const pin = pinAt.get(holeId)
    if (pin) classes.push('pin')
    if (highlightedIds.includes(holeId) || (showProbe && probeTarget?.holeId === holeId)) {
      classes.push('link')
    }
    if (inspectId && pin?.componentId === inspectId) classes.push('inspect')
    if (heldId && validAnchors.has(holeId)) classes.push('target')
    if (preview?.holes.includes(holeId)) {
      classes.push(preview.valid ? 'footprint' : 'blocked')
    }
    return classes.join(' ')
  }

  return (
    <div
      className={`board${heldId ? ' holding' : ''}`}
      style={{ width: BOARD_PX_W, height: BOARD_PX_H }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPreviewAnchor(null)
        }
      }}
      onPointerUp={() => {
        // End tray pointer-hold without drop
        if (dragComponentId && !previewAnchor) {
          /* keep selection; clear hold after click-place path */
        }
      }}
    >
      <div className="gap" />
      <div className="rail" style={{ top: holeY(10), background: '#bf3434' }} />
      <div className="rail" style={{ top: holeY(11), background: '#265ac5' }} />
      <div className="rail" style={{ top: holeY(12), background: '#bf3434' }} />
      <div className="rail" style={{ top: holeY(13), background: '#265ac5' }} />

      {Array.from({ length: VIS_COLS }, (_, i) => i + 1).map((col) => (
        <span key={`c-${col}`} className="label" style={{ left: holeX(col), top: 77 }}>
          {col}
        </span>
      ))}

      {VIS_ROWS.split('').map((row, ri) => (
        <span key={`r-${row}`} className="label" style={{ left: 20, top: holeY(ri) }}>
          {row}
        </span>
      ))}
      {RAIL_LABELS.map((lab, i) => (
        <span key={lab} className="label" style={{ left: 20, top: holeY(10 + i) }}>
          {lab}
        </span>
      ))}

      {VIS_ROWS.split('').map((row, ri) =>
        Array.from({ length: VIS_COLS }, (_, i) => i + 1).map((col) => {
          const id = `${row}${col}`
          const pin = pinAt.get(id)
          return (
            <button
              key={id}
              type="button"
              className={holeClass(id)}
              style={{
                left: holeX(col),
                top: holeY(ri),
                ['--part' as string]: pin?.color,
              }}
              title={pin ? `${id} · ${pin.refDes} pin ${pin.num}` : id}
              aria-label={id}
              onClick={() => tryPlace(id)}
              onPointerEnter={() => {
                if (heldId) setPreviewAnchor(id)
              }}
              onDragOver={(e) => onHoleDragOver(e, id)}
              onDrop={(e) => onHoleDrop(e, id)}
            >
              {pin && pin.num <= 8 && (
                <span className={`pin-number${id.startsWith('F') ? ' lower' : ''}`}>
                  {pin.num}
                </span>
              )}
            </button>
          )
        }),
      )}

      {(
        [
          ['top+', 10],
          ['top-', 11],
          ['bottom+', 12],
          ['bottom-', 13],
        ] as const
      ).map(([rail, ri]) =>
        Array.from({ length: VIS_COLS }, (_, i) => i + 1).map((col) => {
          const id = `rail-${rail}-${col}`
          const pin = pinAt.get(id)
          return (
            <button
              key={id}
              type="button"
              className={holeClass(id)}
              style={{
                left: holeX(col),
                top: holeY(ri),
                ['--part' as string]: pin?.color,
              }}
              title={pin ? `${id} · ${pin.refDes}` : id}
              aria-label={id}
              onClick={() => tryPlace(id)}
              onPointerEnter={() => {
                if (heldId) setPreviewAnchor(id)
              }}
              onDragOver={(e) => onHoleDragOver(e, id)}
              onDrop={(e) => onHoleDrop(e, id)}
            />
          )
        }),
      )}

      {showWires &&
        project.breadboard.wires.map((w) => {
          const a = holePixel(w.fromHoleId)
          const b = holePixel(w.toHoleId)
          if (!a || !b) return null
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy)
          const focused =
            highlightedIds.includes(w.id) ||
            highlightedIds.includes(w.fromHoleId) ||
            highlightedIds.includes(w.toHoleId)
          const proposed = !w.valid
          if (proposed && !showProposed && !focused) return null
          return (
            <div
              key={w.id}
              className={`wire${proposed ? ' proposed' : ''}${focused ? ' focus-route' : ''}`}
              style={{
                left: a.x,
                top: a.y - 2,
                width: len,
                transform: `rotate(${Math.atan2(dy, dx)}rad)`,
                background: proposed ? undefined : w.color,
                ['--route' as string]: w.color,
                opacity: focused ? 1 : proposed ? 0.55 : 0.9,
              }}
            />
          )
        })}

      {project.breadboard.placements.map((p) => {
        const comp = project.circuit.components.find((c) => c.id === p.componentId)
        if (!comp) return null
        const def = getDefinition(comp.type)
        const pts = p.occupiedHoleIds
          .map((id) => holePixel(id))
          .filter(Boolean) as Array<{ x: number; y: number }>
        if (!pts.length) return null
        const cx = pts.reduce((s, h) => s + h.x, 0) / pts.length
        const cy = pts.reduce((s, h) => s + h.y, 0) / pts.length
        const selected = selectedIds.includes(comp.id)
        const isIc = def.category === 'ic'
        const flip = comp.rotation === 180 || comp.rotation === 270

        if (isIc) {
          const bodyY =
            (holeY(terminalRowIndex('E')) + holeY(terminalRowIndex('F'))) / 2
          const minCol = Math.min(
            ...p.occupiedHoleIds.map((id) => Number(id.replace(/^[A-J]/, ''))),
          )
          const bodyX = holeX(minCol) + ((4 - 1) * 38) / 2
          return (
            <button
              key={p.componentId}
              type="button"
              draggable
              className={`piece ic${flip ? ' flipped' : ''}`}
              style={{
                left: bodyX,
                top: bodyY,
                ['--part' as string]: def.color,
                outline: selected ? '2px solid #78efd2' : undefined,
              }}
              title={`${comp.refDes} · NE555P · notch ${flip ? 'right' : 'left'}`}
              onClick={() => select([comp.id])}
              onPointerEnter={() => setInspectId(comp.id)}
              onPointerLeave={() => setInspectId(null)}
              onDragStart={(e) => {
                select([comp.id])
                setDragComponentId(comp.id)
                e.dataTransfer.setData('text/plain', comp.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragComponentId(null)
                setPreviewAnchor(null)
              }}
              onPointerDown={() => {
                select([comp.id])
                setDragComponentId(comp.id)
              }}
            >
              <span className="dip-dot" />
              {p.occupiedHoleIds.map((hid) => {
                const px = holePixel(hid)
                if (!px) return null
                const lower = hid.startsWith('F')
                return (
                  <span
                    key={hid}
                    className={`dip-lead${lower ? ' lower' : ''}`}
                    style={{ left: px.x - bodyX + 71 }}
                  />
                )
              })}
              {comp.refDes}
            </button>
          )
        }

        const isDiode = def.category === 'diode' || def.category === 'led'
        return (
          <button
            key={p.componentId}
            type="button"
            draggable
            className={`piece${isDiode ? ' diode' : ''}`}
            style={{
              left: cx,
              top: cy,
              ['--part' as string]: def.color,
              outline: selected ? '2px solid #78efd2' : undefined,
            }}
            title={`${comp.refDes} · ${comp.value ?? def.label}`}
            onClick={() => select([comp.id])}
            onPointerEnter={() => setInspectId(comp.id)}
            onPointerLeave={() => setInspectId(null)}
            onDragStart={(e) => {
              select([comp.id])
              setDragComponentId(comp.id)
              e.dataTransfer.setData('text/plain', comp.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              setDragComponentId(null)
              setPreviewAnchor(null)
            }}
            onPointerDown={() => {
              select([comp.id])
              setDragComponentId(comp.id)
            }}
          >
            {comp.refDes}
            {isDiode && <span className="cathode-mark">K</span>}
          </button>
        )
      })}

      {showProbe && probeTarget?.holeId && holePixel(probeTarget.holeId) && (
        <div
          className="label"
          style={{
            left: holePixel(probeTarget.holeId)!.x + 28,
            top: holePixel(probeTarget.holeId)!.y - 14,
            color: '#0f766e',
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          PROBE
        </div>
      )}
    </div>
  )
}
