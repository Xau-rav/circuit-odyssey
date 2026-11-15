import { useEffect } from 'react'
import { BuildMode } from './modes/BuildMode'
import { DebugMode } from './modes/DebugMode'
import { useStore } from '../state/store'
import '../ui/theme/template.css'

export default function App() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const saveIdb = useStore((s) => s.saveIdb)
  const fitWires = useStore((s) => s.fitWires)
  const autoSet = useStore((s) => s.autoSet)
  const rotateSelected = useStore((s) => s.rotateSelected)
  const removeSelected = useStore((s) => s.removeSelected)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)

      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (
        meta &&
        (e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault()
        redo()
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveIdb()
      } else if (typing || meta || e.altKey || e.shiftKey) {
        return
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        fitWires()
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        autoSet()
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        rotateSelected()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSelected()
      } else if (e.key === 'Escape') {
        useStore.getState().select([])
        useStore.getState().highlight([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    undo,
    redo,
    saveIdb,
    fitWires,
    autoSet,
    rotateSelected,
    removeSelected,
  ])

  return (
    <div className="co-app flex h-full flex-col overflow-auto">
      <header className="co-header">
        <i aria-hidden="true">⌁</i>
        <div>
          <h1>Circuit Odyssey</h1>
          <p>SPICE-to-breadboard workbench</p>
        </div>
        <nav className="mode-tabs">
          <button
            type="button"
            className={mode === 'build' ? 'primary' : undefined}
            aria-pressed={mode === 'build'}
            onClick={() => setMode('build')}
          >
            Build
          </button>
          <button
            type="button"
            className={mode === 'debug' ? 'primary' : undefined}
            aria-pressed={mode === 'debug'}
            onClick={() => setMode('debug')}
          >
            Debug
          </button>
        </nav>
      </header>

      <div className="co-shell min-h-0 flex-1">
        {mode === 'build' ? <BuildMode /> : <DebugMode />}
      </div>
    </div>
  )
}
