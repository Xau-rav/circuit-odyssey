import { useState } from 'react'
import { useStore } from '../../state/store'

export function AssistantPanel() {
  const chat = useStore((s) => s.chat)
  const aiBusy = useStore((s) => s.aiBusy)
  const aiMode = useStore((s) => s.aiMode)
  const diagnose = useStore((s) => s.diagnose)
  const intentionalFault = useStore((s) => s.intentionalFault)
  const setFault = useStore((s) => s.setFault)
  const load555 = useStore((s) => s.load555)
  const probeTarget = useStore((s) => s.probeTarget)
  const probeConfirmed = useStore((s) => s.probeConfirmed)
  const confirmProbe = useStore((s) => s.confirmProbe)
  const [text, setText] = useState(
    'LED is not blinking — diagnose the 555 circuit.',
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--co-border)] px-4 py-3">
        <h2 className="m-0 text-base">Diagnostic Assistant</h2>
        <p className="muted m-0 mt-1 text-xs">
          Gemini tools against circuit model · key via{' '}
          <code className="font-mono text-[10px]">.env</code>
          {aiMode && (
            <span className="ml-2 rounded border border-[var(--co-border)] px-1.5 py-0.5 text-[10px] text-[var(--co-teal)]">
              {aiMode}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2 border-b border-[var(--co-border)] p-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={intentionalFault === 'missing-reset'}
            onChange={(e) => {
              const on = e.target.checked
              setFault(on ? 'missing-reset' : 'none')
              load555(on)
            }}
          />
          Demo fault: missing RESET (pin 4)
        </label>
        {probeTarget && (
          <div className="rounded-lg border border-[var(--co-border)] bg-[var(--co-surface-2)] p-2 text-xs">
            <div className="font-semibold">Probe request</div>
            <div className="muted">
              net={probeTarget.netId ?? '—'} hole={probeTarget.holeId ?? '—'}
            </div>
            <button
              type="button"
              className="primary mt-2"
              disabled={probeConfirmed}
              onClick={() => confirmProbe()}
            >
              {probeConfirmed ? 'Probe confirmed' : 'Confirm Probe'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-3">
        {chat.length === 0 && (
          <p className="muted text-xs">
            Ask for a diagnosis. Without <code>GEMINI_API_KEY</code>, the offline
            fixture path still walks the missing-RESET demo.
          </p>
        )}
        {chat.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg px-2 py-1.5 text-xs whitespace-pre-wrap ${
              m.role === 'user'
                ? 'border border-[var(--co-border)] bg-[var(--co-blue-soft)]'
                : 'bg-[var(--co-surface-2)]'
            }`}
          >
            <div className="mb-0.5 text-[10px] uppercase text-[var(--co-text-muted)]">
              {m.role}
            </div>
            {m.content}
          </div>
        ))}
      </div>

      <form
        className="border-t border-[var(--co-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void diagnose(text)
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full resize-vertical font-mono text-[13px] leading-relaxed"
        />
        <button type="submit" className="primary mt-2 w-full" disabled={aiBusy}>
          {aiBusy ? 'Diagnosing…' : 'Diagnose'}
        </button>
      </form>
    </div>
  )
}
