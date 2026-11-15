import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

export function PartsTray() {
  const components = useStore((s) => s.project.circuit.components)
  const placements = useStore((s) => s.project.breadboard.placements)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const setDragComponentId = useStore((s) => s.setDragComponentId)
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
            draggable
            aria-pressed={selected}
            onClick={() => select([c.id])}
            onDragStart={(e) => {
              select([c.id])
              setDragComponentId(c.id)
              e.dataTransfer.setData('text/plain', c.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => setDragComponentId(null)}
            onPointerDown={() => {
              select([c.id])
              setDragComponentId(c.id)
            }}
            style={{ ['--part' as string]: def.color }}
            title={
              isPlaced
                ? `${c.refDes} already on board — drag to move`
                : `Drag ${c.refDes} onto the breadboard`
            }
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
