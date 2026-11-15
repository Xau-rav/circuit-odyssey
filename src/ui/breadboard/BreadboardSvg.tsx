import { useMemo, useRef, useState } from 'react'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  HOLE_R,
  PITCH,
} from '../../breadboard/geometry'
import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

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
  const [pan, setPan] = useState({ x: 20, y: 10 })
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)

  const occupied = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of project.breadboard.placements) {
      for (const h of p.occupiedHoleIds) m.set(h, p.componentId)
    }
    return m
  }, [project.breadboard.placements])

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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-[var(--co-border)] bg-[#f0f4f6]">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          type="button"
          className="rounded bg-white/90 px-2 py-1 text-xs shadow"
          onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
        >
          +
        </button>
        <button
          type="button"
          className="rounded bg-white/90 px-2 py-1 text-xs shadow"
          onClick={() => setZoom((z) => Math.max(0.45, z - 0.15))}
        >
          −
        </button>
        <button
          type="button"
          className="rounded bg-white/90 px-2 py-1 text-xs shadow"
          onClick={() => {
            setZoom(1)
            setPan({ x: 20, y: 10 })
          }}
        >
          Fit
        </button>
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
            rx={8}
            fill="#e8edf0"
            stroke="#9bb0bd"
          />
          {/* Rail color cues */}
          <rect x={PITCH * 0.4} y={PITCH * 0.15} width={BOARD_WIDTH - PITCH} height={4} fill="#dc2626" opacity={0.7} />
          <rect x={PITCH * 0.4} y={PITCH * 1.15} width={BOARD_WIDTH - PITCH} height={4} fill="#1f2937" opacity={0.7} />

          {board.holes.map((h) => {
            const isOcc = occupied.has(h.id)
            const isHi = highlightedIds.includes(h.id)
            const isProbe = showProbe && probeTarget?.holeId === h.id
            return (
              <circle
                key={h.id}
                cx={h.x}
                cy={h.y}
                r={HOLE_R}
                fill={isProbe ? '#0d9488' : isHi ? '#1d4e89' : isOcc ? '#475569' : '#2a3540'}
                opacity={isOcc ? 0.85 : 0.55}
              >
                <title>{h.id}</title>
              </circle>
            )
          })}

          {/* Column labels every 5 */}
          {Array.from({ length: 13 }, (_, i) => (i + 1) * 5).map((col) => (
            <text
              key={`col-${col}`}
              x={PITCH * col}
              y={PITCH * 2.6}
              textAnchor="middle"
              fontSize={8}
              fill="#5a6f7c"
              fontFamily="var(--font-mono)"
            >
              {col}
            </text>
          ))}

          {project.breadboard.wires.map((w) => {
            const d = w.path
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
              .join(' ')
            return (
              <path
                key={w.id}
                d={d}
                fill="none"
                stroke={w.valid ? w.color : '#b45309'}
                strokeWidth={w.valid ? 2.2 : 2.2}
                strokeDasharray={w.valid ? undefined : '4 3'}
                opacity={w.assembly === 'needs-revision' ? 0.7 : 0.95}
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
            const minX = Math.min(...xs) - 6
            const maxX = Math.max(...xs) + 6
            const minY = Math.min(...ys) - 6
            const maxY = Math.max(...ys) + 6
            const selected = selectedIds.includes(comp.id)
            const highlighted = highlightedIds.includes(comp.id)
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
                  x={minX}
                  y={minY}
                  width={maxX - minX}
                  height={maxY - minY}
                  rx={def.category === 'ic' ? 3 : 4}
                  fill={def.color}
                  stroke={selected ? '#0d9488' : highlighted ? '#1d4e89' : '#0f172a'}
                  strokeWidth={selected || highlighted ? 2.5 : 1}
                  opacity={0.92}
                />
                {def.category === 'ic' && (
                  <path
                    d={`M ${minX + 4} ${minY} A 4 4 0 0 0 ${minX + 4} ${minY + 8}`}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={1.5}
                  />
                )}
                <text
                  x={(minX + maxX) / 2}
                  y={(minY + maxY) / 2 + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#f8fafc"
                  fontFamily="var(--font-mono)"
                  style={{ pointerEvents: 'none' }}
                >
                  {comp.refDes}
                </text>
                <title>
                  {comp.refDes} {def.label} {comp.value ?? ''}
                  {def.type === 'ne555'
                    ? '\nPins: 1 GND … 4 RESET … 8 VCC'
                    : ''}
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
                      r={8}
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth={2}
                    />
                    <text
                      x={h.x + 10}
                      y={h.y - 8}
                      fontSize={10}
                      fill="#0f766e"
                      fontFamily="var(--font-display)"
                    >
                      PROBE
                    </text>
                  </>
                )
              })()}
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
