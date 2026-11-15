import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

export function PartsTray() {
  const components = useStore((s) => s.project.circuit.components)
  const placements = useStore((s) => s.project.breadboard.placements)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const placed = new Set(placements.map((p) => p.componentId))

  return (
    <div className="tray grid gap-[7px]">
      {components.map((c) => {
        const def = getDefinition(c.type)
        const isPlaced = placed.has(c.id)
        const selected = selectedIds.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={selected}
            onClick={() => select([c.id])}
            className="text-left"
            style={{
              borderLeft: `4px solid ${def.color}`,
              ['--part' as string]: def.color,
            }}
          >
            <span className="font-mono text-[13px] font-semibold">{c.refDes}</span>
            <span className="text-[var(--co-text-muted)]">
              {' '}
              · {c.type === 'ne555' ? 'NE555P profile' : c.value ?? def.label}
              {isPlaced ? ' ✓' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
