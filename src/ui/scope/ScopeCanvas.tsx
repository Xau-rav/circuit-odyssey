import { useEffect, useRef } from 'react'
import { useStore } from '../../state/store'

export function ScopeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveBuffer = useStore((s) => s.liveBuffer)
  const transportKind = useStore((s) => s.transportKind)
  const streaming = useStore((s) => s.streaming)
  const lastStats = useStore((s) => s.lastStats)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // 0–5 V scale
    const vMax = 5
    const samples = liveBuffer.length ? liveBuffer : [0]
    ctx.strokeStyle = transportKind === 'sim' ? '#2dd4bf' : '#38bdf8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < samples.length; i++) {
      const x = (i / Math.max(1, samples.length - 1)) * w
      const y = h - (samples[i]! / vMax) * (h - 16) - 8
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px IBM Plex Mono, monospace'
    ctx.fillText('5 V', 8, 14)
    ctx.fillText('0 V', 8, h - 8)
  }, [liveBuffer, transportKind])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-[var(--co-border)] bg-[#0b1220]">
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            transportKind === 'sim'
              ? 'bg-teal-500/20 text-teal-200'
              : 'bg-sky-500/20 text-sky-200'
          }`}
        >
          {transportKind === 'sim' ? 'SIMULATED' : 'PHYSICAL'}
        </span>
        {streaming && (
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
            LIVE STREAM
          </span>
        )}
        {lastStats && (
          <span className="font-mono text-[11px] text-slate-300">
            mean {lastStats.mean.toFixed(2)} V · pp {lastStats.pp.toFixed(2)} V
            {lastStats.freqHz != null
              ? ` · ~${lastStats.freqHz.toFixed(2)} Hz`
              : ''}
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
