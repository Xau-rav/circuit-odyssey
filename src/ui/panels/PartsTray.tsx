import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

export function PartsTray() {
  const components = useStore((s) => s.project.circuit.components)
  const placements = useStore((s) => s.project.breadboard.placements)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const placed = new Set(placements.map((p) => p.componentId))

  return (
    <div className="tray">
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
            style={{ ['--part' as string]: def.color }}
          >
            {c.refDes} ·{' '}
            {c.type === 'ne555' ? 'NE555P profile' : c.value ?? def.label}
            {isPlaced ? ' ✓' : ''}
          </button>
        )
      })}
    </div>
  )
}
