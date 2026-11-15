import { useState } from 'react'
import { useStore } from '../../state/store'
import { WebSerialTransport } from '../../engines/measurement/transports/WebSerialTransport'

export function MeasurementPanel() {
  const transportKind = useStore((s) => s.transportKind)
  const setTransport = useStore((s) => s.setTransport)
  const connectTransport = useStore((s) => s.connectTransport)
  const disconnectTransport = useStore((s) => s.disconnectTransport)
  const startStream = useStore((s) => s.startStream)
  const stopStream = useStore((s) => s.stopStream)
  const captureAnalyze = useStore((s) => s.captureAnalyze)
  const connectionState = useStore((s) => s.connectionState)
  const streaming = useStore((s) => s.streaming)
  const lastStats = useStore((s) => s.lastStats)
  const history = useStore((s) => s.measurementHistory)
  const probeConfirmed = useStore((s) => s.probeConfirmed)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-3 p-3 text-xs">
      <div>
        <div className="mb-1 font-semibold">Measurement source</div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              transportKind === 'sim'
                ? 'bg-[var(--co-teal)] text-white'
                : 'bg-[var(--co-surface-2)]'
            }`}
            onClick={() => void setTransport('sim')}
          >
            SimTransport
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              transportKind === 'webserial'
                ? 'bg-[var(--co-blue)] text-white'
                : 'bg-[var(--co-surface-2)]'
            }`}
            onClick={() => void setTransport('webserial')}
          >
            Web Serial
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--co-text-muted)]">
          {transportKind === 'sim'
            ? 'Labeled simulated acquisition — never shown as live hardware.'
            : WebSerialTransport.isSupported()
              ? 'Chrome/Edge · UNO Q must use Monitor (not Serial). Safe range 0–5 V via divider → A0 ≤ 3.3 V.'
              : 'Web Serial unsupported in this browser.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded bg-[var(--co-surface-2)] px-2 py-1"
          onClick={() => void run(connectTransport)}
        >
          Connect
        </button>
        <button
          type="button"
          className="rounded bg-[var(--co-surface-2)] px-2 py-1"
          onClick={() => void run(disconnectTransport)}
        >
          Disconnect
        </button>
        <button
          type="button"
          className="rounded bg-[var(--co-surface-2)] px-2 py-1"
          disabled={streaming || (transportKind === 'webserial' && !probeConfirmed)}
          onClick={() => void run(startStream)}
        >
          Start 1 kS/s
        </button>
        <button
          type="button"
          className="rounded bg-[var(--co-surface-2)] px-2 py-1"
          onClick={() => void run(stopStream)}
        >
          Stop
        </button>
        <button
          type="button"
          className="rounded bg-[var(--co-teal)] px-2 py-1 text-white"
          onClick={() => void run(captureAnalyze)}
        >
          Capture & Analyze
        </button>
      </div>

      <div className="rounded border border-[var(--co-border)] bg-[var(--co-surface-2)] p-2 font-mono">
        state: {connectionState}
        {streaming ? ' · streaming' : ''}
        {lastStats && (
          <div className="mt-1">
            mean={lastStats.mean.toFixed(3)}V min={lastStats.min.toFixed(3)} max=
            {lastStats.max.toFixed(3)} pp={lastStats.pp.toFixed(3)}
            {lastStats.freqHz != null &&
              ` freq≈${lastStats.freqHz.toFixed(2)}Hz (c=${(lastStats.freqConfidence ?? 0).toFixed(2)})`}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-red-800">
          {error}
        </div>
      )}

      <div>
        <div className="mb-1 font-semibold">History</div>
        <ul className="max-h-40 space-y-1 overflow-auto">
          {history.length === 0 && (
            <li className="text-[var(--co-text-muted)]">No captures yet</li>
          )}
          {[...history].reverse().map((r) => (
            <li
              key={r.id}
              className="rounded border border-[var(--co-border)] px-2 py-1"
            >
              <span
                className={`mr-1 rounded px-1 text-[10px] font-semibold uppercase ${
                  r.source === 'simulated'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {r.source}
              </span>
              {r.stats.mean.toFixed(2)} V mean · {r.sampleRateHz} Hz ·{' '}
              {new Date(r.startedAt).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
