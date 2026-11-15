import { useRef } from 'react'
import { BreadboardBoard } from '../../ui/breadboard/BreadboardBoard'
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
    <div style={{ display: 'flex', gap: 0, minHeight: 640 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <section className="panel" style={{ height: scopeHeight, marginBottom: 0 }}>
          <div className="toolbar">
            <h2>Oscilloscope</h2>
            <span className="muted" style={{ fontSize: 12 }}>
              Resizable · sim vs physical always labeled
            </span>
          </div>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <ScopeCanvas />
          </div>
        </section>
        <div
          style={{
            height: 6,
            cursor: 'row-resize',
            background: '#344258',
          }}
          onMouseDown={() => {
            drag.current = 'h'
            const onMove = (e: MouseEvent) => {
              if (drag.current === 'h') setScopeHeight(e.clientY - 100)
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
        <div style={{ display: 'flex', flex: 1, minHeight: 280 }}>
          <section className="panel" style={{ flex: 1, marginBottom: 0 }}>
            <h2>Probe breadboard</h2>
            <div className="scroll">
              <BreadboardBoard showProbe />
            </div>
          </section>
          <section className="panel" style={{ width: 280, marginBottom: 0 }}>
            <h2>Capture</h2>
            <MeasurementPanel />
          </section>
        </div>
      </div>

      <div
        style={{ width: 6, cursor: 'col-resize', background: '#344258' }}
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

      <aside style={{ width: panelWidth }}>
        <section className="panel" style={{ height: '100%', padding: 0, overflow: 'hidden' }}>
          <AssistantPanel />
        </section>
      </aside>
    </div>
  )
}
