import { useStore } from '../../state/store'

export function JumpersPanel() {
  const project = useStore((s) => s.project)
  const highlight = useStore((s) => s.highlight)
  const fitWires = useStore((s) => s.fitWires)
  const wires = project.breadboard.wires
  const nets = new Map(project.circuit.nets.map((n) => [n.id, n]))

  return (
    <div>
      <p className="muted mb-3 text-xs">
        Select a route to highlight endpoints. Fit wires applies the current plan.
        Red = VCC, blue-ish dark = GND. Dotted = needs revision.
      </p>
      <div className="mb-3">
        <button type="button" className="primary" onClick={() => fitWires()}>
          Fit wires
        </button>
      </div>
      <div className="grid gap-2">
        {wires.length === 0 && (
          <p className="muted m-0 text-sm">Place parts to see jumper suggestions.</p>
        )}
        {wires.map((w) => {
          const net = nets.get(w.netId)
          const label = `${net?.name ?? w.netId} · ${w.fromHoleId} ↔ ${w.toHoleId}`
          return (
            <div key={w.id} className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => highlight([w.id, w.fromHoleId, w.toHoleId])}
                className="flex-1 text-left"
                style={{ borderColor: w.valid ? w.color : '#a16a46' }}
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
