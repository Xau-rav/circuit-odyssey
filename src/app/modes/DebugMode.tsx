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
    <div className="flex h-[calc(100vh-120px)] min-h-[640px] gap-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0">
        <section className="panel !mb-0 !rounded-b-none" style={{ height: scopeHeight }}>
          <div className="toolbar mb-2 flex items-center gap-2">
            <h2 className="mb-0 mr-auto">Oscilloscope</h2>
            <span className="text-xs text-[var(--co-text-muted)]">
              Resizable · sim vs physical always labeled
            </span>
          </div>
          <div className="h-[calc(100%-36px)]">
            <ScopeCanvas />
          </div>
        </section>
        <div
          className="h-1.5 shrink-0 cursor-row-resize bg-[var(--co-border)] hover:bg-[var(--co-teal)]"
          onMouseDown={() => {
            drag.current = 'h'
            const onMove = (e: MouseEvent) => {
              if (drag.current === 'h') setScopeHeight(e.clientY - 110)
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
          <section className="panel min-w-0 flex-1 !rounded-t-none !rounded-r-none">
            <h2>Probe breadboard</h2>
            <div className="h-[calc(100%-40px)] min-h-[220px]">
              <BreadboardSvg showProbe />
            </div>
          </section>
          <section className="panel w-72 shrink-0 !rounded-none overflow-auto border-l-0">
            <h2>Capture</h2>
            <MeasurementPanel />
          </section>
        </div>
      </div>

      <div
        className="w-1.5 shrink-0 cursor-col-resize bg-[var(--co-border)] hover:bg-[var(--co-teal)]"
        onMouseDown={() => {
          drag.current = 'v'
          const onMove = (e: MouseEvent) => {
            if (drag.current === 'v') {
              setPanelWidth(window.innerWidth - e.clientX - 24)
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

      <aside style={{ width: panelWidth }} className="shrink-0">
        <section className="panel h-full !p-0 overflow-hidden">
          <AssistantPanel />
        </section>
      </aside>
    </div>
  )
}
