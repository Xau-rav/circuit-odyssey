import { BreadboardSvg } from '../../ui/breadboard/BreadboardSvg'
import { AssemblyPanel } from '../../ui/panels/AssemblyPanel'
import { PartsTray } from '../../ui/panels/PartsTray'
import { PinMapPanel } from '../../ui/panels/PinMapPanel'
import { JumpersPanel } from '../../ui/panels/JumpersPanel'
import { useStore } from '../../state/store'

export function BuildMode() {
  const autoSet = useStore((s) => s.autoSet)
  const fitWires = useStore((s) => s.fitWires)
  const generateWiresAction = useStore((s) => s.generateWires)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const load555 = useStore((s) => s.load555)
  const rotateSelected = useStore((s) => s.rotateSelected)
  const saveIdb = useStore((s) => s.saveIdb)
  const loadIdb = useStore((s) => s.loadIdb)
  const exportJson = useStore((s) => s.exportJson)
  const project = useStore((s) => s.project)
  const selectedIds = useStore((s) => s.selectedIds)
  const status =
    selectedIds[0]
      ? `Selected ${project.circuit.components.find((c) => c.id === selectedIds[0])?.refDes ?? selectedIds[0]}. Drag on the board or Auto-set.`
      : `${project.breadboard.placements.length} placed · ${project.breadboard.wires.filter((w) => w.valid).length} wires`

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-3.5 overflow-auto">
        <section className="panel">
          <h2>Netlist / examples</h2>
          <nav className="mb-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => load555(false)}>
              555 timer
            </button>
            <button type="button" onClick={() => load555(true)}>
              555 + RESET fault
            </button>
          </nav>
          <p className="muted mb-3 text-xs">
            Supports resistors, capacitors, diodes/LEDs, DC sources, and one NE555
            profile. Electrical model stays independent of placement.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveIdb()}>
              Save
            </button>
            <button type="button" onClick={() => void loadIdb()}>
              Load
            </button>
            <button type="button" onClick={() => exportJson()}>
              Export JSON
            </button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--co-border-strong)] bg-[var(--co-surface-2)] px-2.5 py-2 text-sm hover:border-[var(--co-teal)] hover:text-[var(--co-teal)]">
              Import
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  useStore.getState().importJson(await file.text())
                }}
              />
            </label>
          </div>
          <p className="status-ok mt-2 min-h-6 text-sm">{project.name}</p>
        </section>

        <section className="panel min-h-0 flex-1">
          <h2>Parts tray</h2>
          <PartsTray />
        </section>
      </aside>

      <div className="flex min-h-0 flex-col gap-3.5 overflow-auto">
        <section className="panel">
          <div className="toolbar mb-2.5 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto mb-0">Breadboard</h2>
            <button type="button" onClick={() => rotateSelected()}>
              Rotate
            </button>
            <button type="button" onClick={() => generateWiresAction()}>
              Gen wires
            </button>
            <button type="button" onClick={() => fitWires()}>
              Fit wires
            </button>
            <button type="button" onClick={() => undo()}>
              Undo
            </button>
            <button type="button" onClick={() => redo()}>
              Redo
            </button>
            <button type="button" className="primary" onClick={() => autoSet()}>
              Auto-set
            </button>
          </div>
          <p className="muted mb-2 text-sm">
            Drag a part onto a hole, or select it and drop on an anchor. Hover a
            part to inspect pins. Auto-set places a valid greedy layout.
          </p>
          <div
            className="mb-2.5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--co-text-muted)]"
            aria-label="Keyboard shortcuts"
          >
            <span>
              <kbd>R</kbd>Rotate
            </span>
            <span>
              <kbd>A</kbd>Auto-set
            </span>
            <span>
              <kbd>F</kbd>Fit wires
            </span>
            <span>
              <kbd>Esc</kbd>Clear selection
            </span>
          </div>
          <div className="scroll overflow-auto py-2">
            <div className="h-[480px] min-w-[720px]">
              <BreadboardSvg />
            </div>
          </div>
          <p className="status-ok mt-2 min-h-6 text-sm" role="status">
            {status}
          </p>
        </section>

        <section className="panel">
          <div className="toolbar mb-2.5 flex flex-wrap items-center gap-2">
            <h2 className="mb-0">To-do</h2>
          </div>
          <AssemblyPanel embedded />
        </section>

        <div className="reports grid gap-3.5 md:grid-cols-2">
          <section className="panel">
            <h2>Terminal → pin → hole</h2>
            <PinMapPanel />
          </section>
          <section className="panel">
            <h2>Suggested jumpers</h2>
            <JumpersPanel />
          </section>
        </div>
      </div>
    </div>
  )
}
