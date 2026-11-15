import { useStore } from '../../state/store'
import type { AssemblyStatus } from '../../core/types'

const STATUSES: AssemblyStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'needs_revision',
  'blocked',
]

export function AssemblyPanel({ embedded = false }: { embedded?: boolean }) {
  const assembly = useStore((s) => s.project.assembly)
  const setAssemblyStatus = useStore((s) => s.setAssemblyStatus)
  const highlight = useStore((s) => s.highlight)

  const list = (
    <div className="tasks grid gap-1.5">
      {assembly.map((step, i) => {
        const attention =
          step.status === 'needs_revision' || step.status === 'blocked'
        return (
          <button
            key={step.id}
            type="button"
            className={`task text-left ${attention ? 'attention' : ''}`}
            style={
              attention
                ? { borderColor: '#a16a46', color: '#ffd2a6' }
                : undefined
            }
            onClick={() => {
              highlight(step.targetIds)
              if (step.status === 'pending') {
                setAssemblyStatus(step.id, 'in_progress')
              }
            }}
          >
            <div className="text-sm font-semibold">
              {i + 1}. {step.title}
            </div>
            {step.detail && (
              <p className="muted mt-1 text-xs leading-snug">{step.detail}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAssemblyStatus(step.id, st)
                  }}
                  className={`!px-1.5 !py-0.5 text-[10px] ${
                    step.status === st ? 'primary' : ''
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </button>
        )
      })}
      {assembly.length === 0 && (
        <p className="muted m-0 text-sm">
          Load a circuit and Auto-set to generate build steps.
        </p>
      )}
    </div>
  )

  if (embedded) return list

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--co-border)] px-3 py-2">
        <h2 className="m-0 text-sm font-semibold">Assembly</h2>
        <p className="muted m-0 text-xs">
          Follow steps · highlights update on the board
        </p>
      </div>
      <div className="flex-1 overflow-auto p-3">{list}</div>
    </div>
  )
}
