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
  const rotateSelected = useStore((s) => s.rotateSelected)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
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
      } else if (typing || meta || e.altKey) {
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
      } else if (e.key === 'Escape') {
        useStore.getState().select([])
        useStore.getState().highlight([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, saveIdb, fitWires, autoSet, rotateSelected])

  return (
    <div className="flex h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1250px] shrink-0 items-center gap-4 border-b border-[var(--co-border)] px-6 py-5">
        <i
          aria-hidden
          className="not-italic rounded-xl bg-[var(--co-teal)] px-3 py-2 text-[22px] leading-none text-[var(--co-teal-ink)]"
        >
          ⌁
        </i>
        <div>
          <h1 className="m-0 text-[25px] font-semibold tracking-tight text-[var(--co-text)]">
            Circuit Odyssey
          </h1>
          <p className="m-0 text-sm text-[var(--co-text-muted)]">
            From Circuit to Reality · SPICE-to-breadboard workbench
          </p>
        </div>

        <nav className="ml-4 flex gap-2">
          <ModeTab active={mode === 'build'} onClick={() => setMode('build')}>
            Build
          </ModeTab>
          <ModeTab active={mode === 'debug'} onClick={() => setMode('debug')}>
            Debug
          </ModeTab>
        </nav>

        <div className="ml-auto text-xs text-[var(--co-text-muted)]">
          Chrome/Edge · Web Serial UNO Q
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto h-full max-w-[1250px] px-6 py-4">
          {mode === 'build' ? <BuildMode /> : <DebugMode />}
        </div>
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
      aria-pressed={active}
      onClick={onClick}
      className={active ? 'primary' : undefined}
    >
      {children}
    </button>
  )
}
