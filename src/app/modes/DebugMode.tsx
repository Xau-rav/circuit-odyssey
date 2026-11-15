import { useRef } from 'react'
import { BreadboardSvg } from '../../ui/breadboard/BreadboardSvg'
import { ScopeCanvas } from '../../ui/scope/ScopeCanvas'
import { AssistantPanel } from '../../ui/panels/AssistantPanel'
import { MeasurementPanel } from '../../ui/panels/MeasurementPanel'
import { useStore } from '../../state/store'

export function DebugMode() {
  const scopeHeight = useStore((s) => s.scopeHeight)
  const panelWidth = useStore((s) => s.panelWidth)
  const setScopeHeight = useStore((s) => s.setScopeHeight)
  const setPanelWidth = useStore((s) => s.setPanelWidth)
  const drag = useRef<'v' | 'h' | null>(null)

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div style={{ height: scopeHeight }} className="shrink-0 p-2 pb-0">
          <ScopeCanvas />
        </div>
        <div
          className="h-1.5 shrink-0 cursor-row-resize bg-[var(--co-border)] hover:bg-[var(--co-teal)]"
          onMouseDown={() => {
            drag.current = 'h'
            const onMove = (e: MouseEvent) => {
              if (drag.current === 'h') setScopeHeight(e.clientY - 56)
            }
            const onUp = () => {
              drag.current = null
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }
            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 p-2">
            <BreadboardSvg showProbe />
          </div>
          <div className="w-72 shrink-0 overflow-auto border-l border-[var(--co-border)] bg-[var(--co-surface)]">
            <div className="border-b border-[var(--co-border)] px-3 py-2 text-sm font-semibold">
              Capture
            </div>
            <MeasurementPanel />
          </div>
        </div>
      </div>

      <div
        className="w-1.5 shrink-0 cursor-col-resize bg-[var(--co-border)] hover:bg-[var(--co-teal)]"
        onMouseDown={() => {
          drag.current = 'v'
          const onMove = (e: MouseEvent) => {
            if (drag.current === 'v') {
              setPanelWidth(window.innerWidth - e.clientX)
            }
          }
          const onUp = () => {
            drag.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      />

      <aside
        style={{ width: panelWidth }}
        className="shrink-0 border-l border-[var(--co-border)]"
      >
        <AssistantPanel />
      </aside>
    </div>
  )
}
