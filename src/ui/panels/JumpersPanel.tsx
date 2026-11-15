import { useStore } from '../../state/store'

export function JumpersPanel() {
  const project = useStore((s) => s.project)
  const highlight = useStore((s) => s.highlight)
  const fitWires = useStore((s) => s.fitWires)
  const wires = project.breadboard.wires
  const nets = new Map(project.circuit.nets.map((n) => [n.id, n]))

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <button type="button" className="primary" onClick={() => fitWires()}>
          Fit wires
        </button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {wires.length === 0 && (
          <p className="muted">Place parts to see jumper suggestions.</p>
        )}
        {wires.map((w) => {
          const net = nets.get(w.netId)
          const label = `${net?.name ?? w.netId} · ${w.fromHoleId} ↔ ${w.toHoleId}`
          return (
            <div key={w.id} className="toolbar" style={{ marginBottom: 0 }}>
              <button
                type="button"
                onClick={() => highlight([w.id, w.fromHoleId, w.toHoleId])}
                style={{ flex: 1, textAlign: 'left' }}
              >
                {label}
                {!w.valid ? ' (revise)' : ''}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
