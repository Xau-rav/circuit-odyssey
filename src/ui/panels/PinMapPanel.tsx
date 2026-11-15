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
    return <p className="muted">Choose a part to inspect its pin map.</p>
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
          <select
            id="profile"
            aria-label="Physical IC package"
            disabled
            style={{ marginBottom: 10, width: '100%' }}
          >
            <option>NE555P · PDIP-8</option>
          </select>
          <p className="muted" style={{ marginBottom: 12, fontSize: 12 }}>
            SPICE argument position → .SUBCKT terminal → NE555P pin → breadboard
            hole. The notch and white dot mark the pin-1 end.
          </p>
        </>
      ) : (
        <p className="muted" style={{ marginBottom: 12 }}>
          {selected.refDes} · {selected.value ?? def.label}
        </p>
      )}
      <table>
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
              <td>{placement?.pinHoleMap[pin.id] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
