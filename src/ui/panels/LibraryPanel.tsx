import { COMPONENT_LIBRARY } from '../../components/library/definitions'
import { useStore } from '../../state/store'

export function LibraryPanel() {
  const components = useStore((s) => s.project.circuit.components)
  const select = useStore((s) => s.select)
  const selectedIds = useStore((s) => s.selectedIds)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--co-border)] px-3 py-2">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Circuit
        </h2>
        <p className="text-xs text-[var(--co-text-muted)]">
          {components.length} parts · electrical model
        </p>
      </div>
      <ul className="flex-1 overflow-auto p-2">
        {components.map((c) => {
          const def = COMPONENT_LIBRARY[c.type]
          const selected = selectedIds.includes(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => select([c.id])}
                className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  selected
                    ? 'bg-[var(--co-teal-soft)] text-[var(--co-teal)]'
                    : 'hover:bg-[var(--co-surface-2)]'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ background: def?.color ?? '#64748b' }}
                />
                <span className="font-mono text-xs font-semibold">{c.refDes}</span>
                <span className="truncate text-xs text-[var(--co-text-muted)]">
                  {def?.label} {c.value}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="border-t border-[var(--co-border)] p-2">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--co-text-muted)]">
          Library
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.values(COMPONENT_LIBRARY).map((d) => (
            <span
              key={d.type}
              className="rounded bg-[var(--co-surface-2)] px-1.5 py-0.5 text-[10px]"
              title={d.label}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
