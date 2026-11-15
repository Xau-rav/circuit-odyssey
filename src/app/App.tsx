import { useEffect } from 'react'
import { BuildMode } from './modes/BuildMode'
import { DebugMode } from './modes/DebugMode'
import { useStore } from '../state/store'

export default function App() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const saveIdb = useStore((s) => s.saveIdb)
  const fitWires = useStore((s) => s.fitWires)
  const autoSet = useStore((s) => s.autoSet)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveIdb()
      } else if (e.key.toLowerCase() === 'f' && !meta && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        fitWires()
      } else if (e.key.toLowerCase() === 'a' && e.shiftKey && !meta) {
        autoSet()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, saveIdb, fitWires, autoSet])

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-[var(--co-border)] bg-[var(--co-surface)]/95 px-4 backdrop-blur">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--co-teal)]">
            Circuit Odyssey
          </span>
          <span className="hidden text-xs text-[var(--co-text-muted)] sm:inline">
            From Circuit to Reality
          </span>
        </div>

        <nav className="flex rounded-md border border-[var(--co-border)] p-0.5">
          <ModeTab active={mode === 'build'} onClick={() => setMode('build')}>
            Build
          </ModeTab>
          <ModeTab active={mode === 'debug'} onClick={() => setMode('debug')}>
            Debug
          </ModeTab>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-[11px] text-[var(--co-text-muted)]">
          <span>Desktop Chrome/Edge · Web Serial for UNO Q</span>
          <span className="rounded bg-[var(--co-teal-soft)] px-1.5 py-0.5 font-medium text-[var(--co-teal)]">
            MVP
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {mode === 'build' ? <BuildMode /> : <DebugMode />}
      </main>
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-sm font-medium transition ${
        active
          ? 'bg-[var(--co-teal)] text-white'
          : 'text-[var(--co-text-muted)] hover:text-[var(--co-text)]'
      }`}
    >
      {children}
    </button>
  )
}
