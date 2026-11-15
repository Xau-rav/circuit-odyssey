import { useStore } from '../../state/store'
import { statusColor } from '../theme/tokens'
import type { AssemblyStatus } from '../../core/types'

const STATUSES: AssemblyStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'needs_revision',
  'blocked',
]

export function AssemblyPanel() {
  const assembly = useStore((s) => s.project.assembly)
  const setAssemblyStatus = useStore((s) => s.setAssemblyStatus)
  const highlight = useStore((s) => s.highlight)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--co-border)] px-3 py-2">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--co-text)]">
          Assembly
        </h2>
        <p className="text-xs text-[var(--co-text-muted)]">
          Follow steps · highlights update on the board
        </p>
      </div>
      <ul className="flex-1 space-y-2 overflow-auto p-3">
        {assembly.map((step, i) => (
          <li
            key={step.id}
            className="rounded-md border border-[var(--co-border)] bg-[var(--co-surface)] p-2"
            style={{ borderLeftWidth: 3, borderLeftColor: statusColor[step.status] }}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => highlight(step.targetIds)}
            >
              <div className="text-xs font-semibold text-[var(--co-text)]">
                {i + 1}. {step.title}
              </div>
              {step.detail && (
                <p className="mt-1 text-[11px] leading-snug text-[var(--co-text-muted)]">
                  {step.detail}
                </p>
              )}
            </button>
            <div className="mt-2 flex flex-wrap gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAssemblyStatus(step.id, st)}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    step.status === st
                      ? 'bg-[var(--co-teal)] text-white'
                      : 'bg-[var(--co-surface-2)] text-[var(--co-text-muted)]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
