import { useMemo, useState } from 'react'
import { getDefinition } from '../../components/library/definitions'
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
  const selectedIds = useStore((s) => s.selectedIds)
  const highlightedIds = useStore((s) => s.highlightedIds)
  const probeTarget = useStore((s) => s.probeTarget)
  const select = useStore((s) => s.select)
  const moveComponent = useStore((s) => s.moveComponent)
  const [held, setHeld] = useState<string | null>(null)
  const [inspectId, setInspectId] = useState<string | null>(null)

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

  const placeSelectedOrHeld = (holeId: string) => {
    const id = held ?? selectedIds[0]
    if (!id) return
    const comp = project.circuit.components.find((c) => c.id === id)
    if (!comp) return
    // Power parts: allow rail holes; others need terminal
    moveComponent(id, holeId)
    setHeld(null)
  }

  return (
    <div className={`board${held ? ' holding' : ''}`} style={{ width: BOARD_PX_W, height: BOARD_PX_H }}>
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

      {/* Terminal holes */}
      {VIS_ROWS.split('').map((row, ri) =>
        Array.from({ length: VIS_COLS }, (_, i) => i + 1).map((col) => {
          const id = `${row}${col}`
          return (
            <HoleButton
              key={id}
              holeId={id}
              x={holeX(col)}
              y={holeY(ri)}
              pin={pinAt.get(id)}
              linked={highlightedIds.includes(id)}
              probe={showProbe && probeTarget?.holeId === id}
              inspect={
                inspectId
                  ? pinAt.get(id)?.componentId === inspectId
                  : false
              }
              onClick={() => placeSelectedOrHeld(id)}
            />
          )
        }),
      )}

      {/* Rail holes */}
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
          return (
            <HoleButton
              key={id}
              holeId={id}
              x={holeX(col)}
              y={holeY(ri)}
              pin={pinAt.get(id)}
              linked={highlightedIds.includes(id)}
              probe={showProbe && probeTarget?.holeId === id}
              inspect={inspectId ? pinAt.get(id)?.componentId === inspectId : false}
              onClick={() => placeSelectedOrHeld(id)}
            />
          )
        }),
      )}

      {/* Wires */}
      {project.breadboard.wires.map((w) => {
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

      {/* Pieces */}
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
          // Align body between E/F channel like template
          const bodyY = (holeY(terminalRowIndex('E')) + holeY(terminalRowIndex('F'))) / 2
          const minCol = Math.min(
            ...p.occupiedHoleIds.map((id) => Number(id.replace(/^[A-J]/, ''))),
          )
          const bodyX = holeX(minCol) + ((4 - 1) * 38) / 2
          return (
            <button
              key={p.componentId}
              type="button"
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
              onPointerDown={() => {
                select([comp.id])
                setHeld(comp.id)
              }}
              onPointerUp={() => setHeld(null)}
            >
              <span className="dip-dot" />
              {p.occupiedHoleIds.map((hid) => {
                const px = holePixel(hid)
                const pin = pinAt.get(hid)
                if (!px || !pin) return null
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
            onPointerDown={() => {
              select([comp.id])
              setHeld(comp.id)
            }}
            onPointerUp={() => setHeld(null)}
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

function HoleButton({
  holeId,
  x,
  y,
  pin,
  linked,
  probe,
  inspect,
  onClick,
}: {
  holeId: string
  x: number
  y: number
  pin?: { color: string; num: number; refDes: string }
  linked: boolean
  probe: boolean
  inspect: boolean
  onClick: () => void
}) {
  const cls = [
    'hole',
    pin ? 'pin' : '',
    linked || probe ? 'link' : '',
    inspect ? 'inspect' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      style={{
        left: x,
        top: y,
        ['--part' as string]: pin?.color,
      }}
      title={
        pin
          ? `${holeId} · ${pin.refDes} pin ${pin.num}`
          : holeId
      }
      aria-label={holeId}
      onClick={onClick}
    >
      {pin && pin.num <= 8 && (
        <span className={`pin-number${holeId.startsWith('F') ? ' lower' : ''}`}>
          {pin.num}
        </span>
      )}
    </button>
  )
}
