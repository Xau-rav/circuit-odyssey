import { useMemo, useRef, useState } from 'react'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CHANNEL_GAP,
  PITCH,
  TOP_ROWS,
} from '../../breadboard/geometry'
import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

const HOLE = 8.5

export function BreadboardSvg({
  interactive = true,
  showProbe = false,
}: {
  interactive?: boolean
  showProbe?: boolean
}) {
  const board = useStore((s) => s.board)
  const project = useStore((s) => s.project)
  const selectedIds = useStore((s) => s.selectedIds)
  const highlightedIds = useStore((s) => s.highlightedIds)
  const probeTarget = useStore((s) => s.probeTarget)
  const select = useStore((s) => s.select)
  const moveComponent = useStore((s) => s.moveComponent)
  const [dragId, setDragId] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 12, y: 8 })
  const [zoom, setZoom] = useState(0.95)
  const svgRef = useRef<SVGSVGElement>(null)

  const pinOwner = useMemo(() => {
    const m = new Map<string, { componentId: string; pinId: string; color: string; num?: number }>()
    for (const p of project.breadboard.placements) {
      const comp = project.circuit.components.find((c) => c.id === p.componentId)
      if (!comp) continue
      const def = getDefinition(comp.type)
      for (const [pinId, holeId] of Object.entries(p.pinHoleMap)) {
        const pin = def.pins.find((x) => x.id === pinId)
        m.set(holeId, {
          componentId: comp.id,
          pinId,
          color: def.color,
          num: pin?.number,
        })
      }
    }
    return m
  }, [project])

  const clientToBoard = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }

  const nearestHole = (x: number, y: number) => {
    let best: string | null = null
    let bestD = Infinity
    for (const h of board.holes) {
      if (h.region !== 'terminal' && h.region !== 'rail') continue
      const d = (h.x - x) ** 2 + (h.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = h.id
      }
    }
    return best
  }

  const channelY =
    PITCH * 3 + TOP_ROWS.length * PITCH + CHANNEL_GAP / 2 - PITCH / 2

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[14px] border border-[var(--co-border)] bg-[var(--co-surface-2)]">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {[
          ['+', () => setZoom((z) => Math.min(2.2, z + 0.15))],
          ['−', () => setZoom((z) => Math.max(0.45, z - 0.15))],
          [
            'Fit',
            () => {
              setZoom(0.95)
              setPan({ x: 12, y: 8 })
            },
          ],
        ].map(([label, fn]) => (
          <button key={String(label)} type="button" className="!px-2 !py-1 text-xs" onClick={fn as () => void}>
            {label as string}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="touch-none"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom((z) => Math.max(0.45, Math.min(2.2, z - e.deltaY * 0.001)))
          } else {
            setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
          }
        }}
        onMouseUp={(e) => {
          if (!interactive || !dragId) return
          const pt = clientToBoard(e.clientX, e.clientY)
          const hole = nearestHole(pt.x, pt.y)
          if (hole) moveComponent(dragId, hole)
          setDragId(null)
        }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <rect
            x={0}
            y={0}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            rx={14}
            fill="var(--co-bb-body)"
          />
          <rect
            x={0}
            y={BOARD_HEIGHT - 8}
            width={BOARD_WIDTH}
            height={8}
            rx={4}
            fill="var(--co-bb-inset)"
          />
          {/* Center channel */}
          <rect
            x={PITCH * 1.5}
            y={channelY - 6}
            width={BOARD_WIDTH - PITCH * 3}
            height={14}
            rx={3}
            fill="var(--co-bb-inset)"
          />
          {/* Rail cues */}
          <line
            x1={PITCH}
            y1={PITCH * 0.5}
            x2={BOARD_WIDTH - PITCH}
            y2={PITCH * 0.5}
            stroke="var(--co-rail-red)"
            strokeWidth={2}
            opacity={0.45}
          />
          <line
            x1={PITCH}
            y1={PITCH * 1.5}
            x2={BOARD_WIDTH - PITCH}
            y2={PITCH * 1.5}
            stroke="var(--co-rail-blue)"
            strokeWidth={2}
            opacity={0.45}
          />

          {Array.from({ length: 13 }, (_, i) => (i + 1) * 5).map((col) => (
            <text
              key={`col-${col}`}
              x={PITCH * col}
              y={PITCH * 2.55}
              textAnchor="middle"
              fontSize={11}
              fill="var(--co-bb-text)"
              fontFamily="var(--font-mono)"
            >
              {col}
            </text>
          ))}

          {board.holes.map((h) => {
            const owner = pinOwner.get(h.id)
            const isHi = highlightedIds.includes(h.id)
            const isProbe = showProbe && probeTarget?.holeId === h.id
            const fill = owner
              ? owner.color
              : isProbe
                ? '#78efd2'
                : isHi
                  ? '#afe3d0'
                  : 'var(--co-bb-hole)'
            return (
              <g key={h.id} transform={`translate(${h.x},${h.y})`}>
                <rect
                  x={-HOLE / 2}
                  y={-HOLE / 2}
                  width={HOLE}
                  height={HOLE}
                  rx={4}
                  fill={fill}
                  stroke={isProbe ? '#146b54' : isHi ? '#18876e' : 'transparent'}
                  strokeWidth={isProbe || isHi ? 2 : 0}
                >
                  <title>{h.id}{owner ? ` · pin ${owner.num ?? owner.pinId}` : ''}</title>
                </rect>
                {!owner && (
                  <rect
                    x={-2}
                    y={-2}
                    width={4}
                    height={4}
                    rx={1}
                    fill="var(--co-bb-hole-core)"
                    pointerEvents="none"
                  />
                )}
                {owner?.num != null && owner.componentId && (
                  <text
                    y={h.row === 'F' || (TOP_ROWS as readonly string[]).includes(h.row) === false && Number(owner.num) >= 5 ? 14 : -10}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#202a37"
                    fontFamily="var(--font-mono)"
                    pointerEvents="none"
                  >
                    {owner.num}
                  </text>
                )}
              </g>
            )
          })}

          {project.breadboard.wires.map((w) => {
            const d = w.path
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
              .join(' ')
            const focused = highlightedIds.includes(w.id)
            return (
              <path
                key={w.id}
                d={d}
                fill="none"
                stroke={w.valid ? w.color : '#697481'}
                strokeWidth={focused ? 5 : 4}
                strokeLinecap="round"
                strokeDasharray={w.valid ? undefined : '6 4'}
                opacity={focused ? 1 : w.valid ? 0.9 : 0.55}
                onClick={(e) => {
                  e.stopPropagation()
                  select([w.id])
                }}
              />
            )
          })}

          {project.breadboard.placements.map((p) => {
            const comp = project.circuit.components.find((c) => c.id === p.componentId)
            if (!comp) return null
            const def = getDefinition(comp.type)
            const holes = p.occupiedHoleIds
              .map((id) => board.holeById.get(id))
              .filter(Boolean)
            if (!holes.length) return null
            const xs = holes.map((h) => h!.x)
            const ys = holes.map((h) => h!.y)
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)
            const cx = (minX + maxX) / 2
            const cy = (minY + maxY) / 2
            const selected = selectedIds.includes(comp.id)
            const highlighted = highlightedIds.includes(comp.id)
            const isIc = def.category === 'ic'

            if (isIc) {
              const bodyW = maxX - minX + 28
              const bodyH = 28
              return (
                <g
                  key={p.componentId}
                  style={{ cursor: interactive ? 'grab' : 'default' }}
                  onMouseDown={(e) => {
                    if (!interactive) return
                    e.stopPropagation()
                    select([comp.id])
                    setDragId(comp.id)
                  }}
                >
                  {/* DIP leads */}
                  {holes.map((h) => (
                    <rect
                      key={`lead-${h!.id}`}
                      x={h!.x - 3}
                      y={h!.y < cy ? cy - bodyH / 2 - 10 : cy + bodyH / 2}
                      width={6}
                      height={10}
                      rx={1}
                      fill="url(#leadGrad)"
                    />
                  ))}
                  <rect
                    x={cx - bodyW / 2}
                    y={cy - bodyH / 2}
                    width={bodyW}
                    height={bodyH}
                    rx={6}
                    fill={`color-mix(in srgb, ${def.color} 24%, #131b29)`}
                    stroke={selected || highlighted ? '#78efd2' : def.color}
                    strokeWidth={selected || highlighted ? 2 : 1}
                  />
                  {/* notch */}
                  <path
                    d={`M ${cx - bodyW / 2} ${cy - 7} A 7 7 0 0 1 ${cx - bodyW / 2} ${cy + 7}`}
                    fill="var(--co-bb-inset)"
                    stroke={def.color}
                  />
                  {/* pin-1 dot */}
                  <circle cx={cx - bodyW / 2 + 12} cy={cy + 8} r={2.5} fill="#f1e7fd" />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="#fff"
                    fontFamily="var(--font-mono)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {comp.refDes}
                  </text>
                  <title>{comp.refDes} · NE555P · pins 1–8</title>
                </g>
              )
            }

            return (
              <g
                key={p.componentId}
                style={{ cursor: interactive ? 'grab' : 'default' }}
                onMouseDown={(e) => {
                  if (!interactive) return
                  e.stopPropagation()
                  select([comp.id])
                  setDragId(comp.id)
                }}
              >
                <rect
                  x={minX - 10}
                  y={minY - 8}
                  width={maxX - minX + 20}
                  height={maxY - minY + 16}
                  rx={5}
                  fill={`color-mix(in srgb, ${def.color} 24%, #131b29)`}
                  stroke={selected || highlighted ? '#78efd2' : def.color}
                  strokeWidth={selected || highlighted ? 2 : 1}
                />
                {def.category === 'diode' || def.category === 'led' ? (
                  <text
                    x={maxX + 2}
                    y={cy + 3}
                    fontSize={10}
                    fill="#f8b5e6"
                    fontFamily="var(--font-mono)"
                    pointerEvents="none"
                  >
                    K
                  </text>
                ) : null}
                <text
                  x={cx}
                  y={cy + 3}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#fff"
                  fontFamily="var(--font-mono)"
                  style={{ pointerEvents: 'none' }}
                >
                  {comp.refDes}
                </text>
                <title>
                  {comp.refDes} {def.label} {comp.value ?? ''}
                </title>
              </g>
            )
          })}

          {showProbe && probeTarget?.holeId && board.holeById.get(probeTarget.holeId) && (
            <g>
              {(() => {
                const h = board.holeById.get(probeTarget.holeId)!
                return (
                  <>
                    <circle
                      cx={h.x}
                      cy={h.y}
                      r={11}
                      fill="none"
                      stroke="#78efd2"
                      strokeWidth={2}
                    />
                    <text
                      x={h.x + 12}
                      y={h.y - 10}
                      fontSize={11}
                      fontWeight={700}
                      fill="#78efd2"
                      fontFamily="var(--font-display)"
                    >
                      PROBE
                    </text>
                  </>
                )
              })()}
            </g>
          )}

          <defs>
            <linearGradient id="leadGrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#929baa" />
              <stop offset="50%" stopColor="#ecedf4" />
              <stop offset="100%" stopColor="#929baa" />
            </linearGradient>
          </defs>
        </g>
      </svg>
    </div>
  )
}
