import { getDefinition } from '../../components/library/definitions'
import { useStore } from '../../state/store'

export function PinMapPanel() {
  const project = useStore((s) => s.project)
  const selectedIds = useStore((s) => s.selectedIds)
  const selected =
    project.circuit.components.find((c) => c.id === selectedIds[0]) ?? null
  const placement = selected
    ? project.breadboard.placements.find((p) => p.componentId === selected.id)
    : null

  if (!selected) {
    return <p className="muted m-0 text-sm">Choose a part to inspect its pin map.</p>
  }

  const def = getDefinition(selected.type)
  const netName = (netId: string | null) => {
    if (!netId) return '—'
    return project.circuit.nets.find((n) => n.id === netId)?.name ?? netId
  }

  return (
    <div>
      {selected.type === 'ne555' ? (
        <>
          <select aria-label="Physical IC package" className="mb-2 w-full" disabled>
            <option>NE555P · PDIP-8</option>
          </select>
          <p className="muted mb-3 text-xs">
            Terminal → net → NE555P pin → breadboard hole. Notch / pin-1 end faces
            the channel-side GND row when Auto-Set places the DIP.
          </p>
        </>
      ) : (
        <p className="muted mb-3 text-sm">
          {selected.refDes} · {selected.value ?? def.label}
        </p>
      )}
      <table className="co-table">
        <thead>
          <tr>
            <th>Terminal</th>
            <th>Net</th>
            <th>Pin</th>
            <th>Hole</th>
          </tr>
        </thead>
        <tbody>
          {def.pins.map((pin) => (
            <tr key={pin.id}>
              <td>{pin.name}</td>
              <td>{netName(selected.pins[pin.id]?.netId ?? null)}</td>
              <td>{pin.number}</td>
              <td className="font-mono">
                {placement?.pinHoleMap[pin.id] ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
