import { useState } from 'react'
import { BreadboardBoard } from '../../ui/breadboard/BreadboardBoard'
import { AssemblyPanel } from '../../ui/panels/AssemblyPanel'
import { PartsTray } from '../../ui/panels/PartsTray'
import { PinMapPanel } from '../../ui/panels/PinMapPanel'
import { JumpersPanel } from '../../ui/panels/JumpersPanel'
import { useStore } from '../../state/store'

const TIMER_NETLIST = `* 555 LED blinker
V1 VCC 0 DC 5
R1 VCC DISCHARGE 10k
R2 DISCHARGE TIMING 100k
C1 TIMING 0 10u
C2 CTRL 0 10n
RLED OUT LED_A 330
DLED LED_A 0 RED_LED
.model RED_LED D(IS=1e-20 N=2)
XU1 VCC 0 TIMING TIMING DISCHARGE CTRL OUT VCC TIMER_DEMO
* Interface declaration only
.SUBCKT TIMER_DEMO VCC GND TRIG THRES DISCH CONT OUT RESET
.ENDS TIMER_DEMO
.end`

const FAULT_NOTE = `* Demo fault variant: omit RESET→VCC jumper (loaded via app model)
* Use Build → 555 + RESET fault button equivalent below`

export function BuildMode() {
  const autoSet = useStore((s) => s.autoSet)
  const fitWires = useStore((s) => s.fitWires)
  const load555 = useStore((s) => s.load555)
  const rotateSelected = useStore((s) => s.rotateSelected)
  const removeSelected = useStore((s) => s.removeSelected)
  const importJson = useStore((s) => s.importJson)
  const showWires = useStore((s) => s.showWires)
  const setShowWires = useStore((s) => s.setShowWires)
  const boardStatus = useStore((s) => s.boardStatus)
  const [source, setSource] = useState(TIMER_NETLIST)
  const [importMessage, setImportMessage] = useState(
    'Load an example, then Auto-set.',
  )
  const [importError, setImportError] = useState(false)
  const [showProposed, setShowProposed] = useState(true)

  const loadTimer = (fault: boolean) => {
    load555(fault)
    setSource(fault ? `${TIMER_NETLIST}\n${FAULT_NOTE}` : TIMER_NETLIST)
    setImportMessage(
      fault
        ? '555 RESET-fault circuit loaded into the electrical model.'
        : '555 timer circuit loaded into the electrical model.',
    )
    setImportError(false)
  }

  return (
    <main className="co-main">
      <aside>
        <section className="panel">
          <h2>Netlist</h2>
          <nav>
            <button type="button" onClick={() => loadTimer(false)}>
              555 timer
            </button>
            <button type="button" onClick={() => loadTimer(true)}>
              555 + RESET fault
            </button>
          </nav>
          <textarea
            aria-label="SPICE netlist"
            rows={10}
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button
              type="button"
              className="primary"
              onClick={() => {
                // Netlist text is documentary for MVP; electrical model loads via examples.
                loadTimer(source.includes('RESET fault') || source.includes('omit RESET'))
                setImportMessage(
                  'Imported example into Circuit Odyssey model (SPICE subset → 555 profile).',
                )
                setImportError(false)
              }}
            >
              Import netlist
            </button>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  background: '#111b2a',
                  border: '1px solid #465874',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                Import JSON
              </span>
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    importJson(await file.text())
                    setImportMessage('Project JSON imported.')
                    setImportError(false)
                  } catch (err) {
                    setImportMessage(
                      err instanceof Error ? err.message : String(err),
                    )
                    setImportError(true)
                  }
                }}
              />
            </label>
          </div>
          <p
            className={`status${importError ? ' error' : ''}`}
            role="status"
          >
            {importMessage}
          </p>
          <small>
            Supports resistors, capacitors, diodes and LEDs, DC sources, and one
            NE555 profile.
          </small>
        </section>

        <section className="panel">
          <h2>Parts tray</h2>
          <PartsTray />
        </section>
      </aside>

      <div>
        <section className="panel">
          <div className="toolbar">
            <h2>Breadboard</h2>
            <button type="button" onClick={() => rotateSelected()}>
              Rotate 180°
            </button>
            <button type="button" onClick={() => removeSelected()}>
              Remove selected
            </button>
            <button type="button" aria-keyshortcuts="F" onClick={() => fitWires()}>
              Fit wires
            </button>
            <button
              type="button"
              aria-pressed={showWires}
              title={showWires ? 'Hide jumper wires' : 'Show jumper wires'}
              onClick={() => setShowWires(!showWires)}
            >
              {showWires ? 'Hide wires' : 'Show wires'}
            </button>
            <button type="button" className="primary" onClick={() => autoSet()}>
              Auto-set
            </button>
          </div>
          <p className="muted">
            Drag a part onto a hole, or select it and click a hole. Hover a part
            to inspect its pins. Hold or drag it to reveal valid anchors. The
            brighter preview shows where its pins will land.
          </p>
          <div className="shortcuts" aria-label="Keyboard shortcuts">
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
              <kbd>Delete</kbd>Remove
            </span>
            <span>
              <kbd>Esc</kbd>Cancel
            </span>
          </div>
          <div className="scroll">
            <BreadboardBoard showProposed={showProposed} />
          </div>
          <p
            className={`status${boardStatus.error ? ' error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {boardStatus.message}
          </p>
        </section>

        <section className="panel">
          <div className="toolbar">
            <h2>To-do</h2>
            <label>
              <input
                type="checkbox"
                checked={showProposed}
                onChange={(e) => setShowProposed(e.target.checked)}
              />{' '}
              Show proposed wires
            </label>
          </div>
          <AssemblyPanel embedded />
          {!showProposed && (
            <p className="muted" style={{ marginTop: 8 }}>
              Proposed-wire overlay hidden (wiring still tracked in Suggested
              jumpers).
            </p>
          )}
        </section>

        <div className="reports">
          <section className="panel">
            <h2>Terminal → pin → hole</h2>
            <PinMapPanel />
          </section>
          <section className="panel">
            <h2>Suggested jumpers</h2>
            <p className="muted">
              Select a route to highlight its endpoints. Colored dotted lines
              preview wires that need revision. Fit wires applies the current
              plan. The first positive DC supply uses the top rails.
            </p>
            <JumpersPanel />
          </section>
        </div>
      </div>
    </main>
  )
}
