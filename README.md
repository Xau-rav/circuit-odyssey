# Circuit Odyssey

**From Circuit to Reality** — local-first breadboard builder & debugger (hackathon MVP).

Design → Auto-Set → Assemble → Measure (sim or UNO Q) → Gemini-guided diagnosis.

## Quick start

```bash
cd circuit-odyssey
npm install
cp .env.example .env.local   # optional: GEMINI_API_KEY=...
npm run dev                  # http://localhost:5173
```

Chrome or Edge recommended (Web Serial). Desktop layout is fixed/resizable for Debug panes.

```bash
npm test          # Vitest (pin maps, connectivity, routing, AI gates)
npm run build     # production build
```

## Demo path

See [`docs/demo-script.md`](docs/demo-script.md). Minimum: 555 layout → Auto-Set → assembly → Debug sim → missing-RESET diagnosis.

## Architecture

| Area | Location |
|---|---|
| Electrical + breadboard models | `src/core`, `src/breadboard` (no React imports) |
| 555 / library | `src/components/library` |
| Placement / routing / assembly | `src/engines/*` |
| Sim + Web Serial transports | `src/engines/measurement/transports` |
| Gemini tools + validators | `src/engines/ai` |
| UNO Q firmware (`Monitor`) | `firmware/uno-q/measurement_stream/` |
| Probe divider BOM | `hardware/probe-frontend/` |

Gemini calls go through the Vite `/api/gemini` proxy using server-side `GEMINI_API_KEY`. Keys are never pasted in-app and never exported in project JSON.

## Hardware notes

- Arduino **UNO Q 4GB** only in this MVP.
- Sketches must use **`Monitor`** (RouterBridge), **not** `Serial`.
- A0 is **not 5 V tolerant** — use the divider front-end (0–5 V circuit → ≤3.3 V ADC).
- Claimed measurement: **≥1 kS/s**, DC/blink — **not** 100 kS/s until PoC.
- If Web Serial fails on-device, Linux WebSocket bridge is the approved fallback (not implemented in this tree yet).

## Status (MVP)

| Feature | State |
|---|---|
| Build/Debug shell, branding | Done |
| 830 breadboard + SVG + library | Done |
| 555 example, Auto-Set, wires, Fit Wires, undo/redo | Done |
| Assembly panel + highlights | Done |
| SimTransport scope + Capture & Analyze + history tags | Done |
| Gemini / fixture RESET diagnosis | Done (live if key; else fixture) |
| Web Serial client | Done (needs board + firmware) |
| UNO Q firmware sketch | Done (best-effort; unproven throughput) |
| Full SPICE | Out of scope |

## License

Hackathon prototype — team use.
