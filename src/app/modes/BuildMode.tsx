import { BreadboardSvg } from '../../ui/breadboard/BreadboardSvg'
import { AssemblyPanel } from '../../ui/panels/AssemblyPanel'
import { LibraryPanel } from '../../ui/panels/LibraryPanel'
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

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--co-border)] bg-[var(--co-surface)]">
        <LibraryPanel />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--co-border)] bg-[var(--co-surface)] px-2 py-1.5">
          <ToolBtn onClick={() => load555(false)}>Load 555</ToolBtn>
          <ToolBtn onClick={() => autoSet()}>Auto-Set</ToolBtn>
          <ToolBtn onClick={() => generateWiresAction()}>Gen Wires</ToolBtn>
          <ToolBtn onClick={() => fitWires()}>Fit Wires</ToolBtn>
          <ToolBtn onClick={() => rotateSelected()}>Rotate</ToolBtn>
          <span className="mx-1 h-4 w-px bg-[var(--co-border)]" />
          <ToolBtn onClick={() => undo()}>Undo</ToolBtn>
          <ToolBtn onClick={() => redo()}>Redo</ToolBtn>
          <span className="mx-1 h-4 w-px bg-[var(--co-border)]" />
          <ToolBtn onClick={() => void saveIdb()}>Save</ToolBtn>
          <ToolBtn onClick={() => void loadIdb()}>Load</ToolBtn>
          <ToolBtn onClick={() => exportJson()}>Export JSON</ToolBtn>
          <label className="cursor-pointer rounded px-2 py-1 text-xs hover:bg-[var(--co-surface-2)]">
            Import
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                useStore.getState().importJson(text)
              }}
            />
          </label>
          <span className="ml-auto truncate font-mono text-[11px] text-[var(--co-text-muted)]">
            {project.name} · {project.breadboard.placements.length} placed ·{' '}
            {project.breadboard.wires.filter((w) => w.valid).length} wires
          </span>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <BreadboardSvg />
        </div>
      </section>

      <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--co-border)] bg-[var(--co-surface)]">
        <AssemblyPanel />
      </aside>
    </div>
  )
}

function ToolBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-1 text-xs font-medium text-[var(--co-text)] hover:bg-[var(--co-teal-soft)] hover:text-[var(--co-teal)]"
    >
      {children}
    </button>
  )
}
