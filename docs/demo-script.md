# Circuit Odyssey — Devpost demo script (~3–4 min)

## Setup

1. `cd circuit-odyssey && npm install && npm run dev`
2. Optional: copy `.env.example` → `.env.local` and set `GEMINI_API_KEY` (fixture path works without it).
3. Chrome or Edge, desktop window (~1440×900).

## Script

1. **Brand + Build Mode** — Point at Circuit Odyssey header; show loaded 555 astable project in the circuit list.
2. **Auto-Set** — Click **Auto-Set**; DIP-8 crosses the channel; passives place nearby.
3. **Wires** — **Gen Wires** / **Fit Wires**; red=VCC, black=GND, teal/blue=signal.
4. **Assembly** — Walk 2–3 steps; click a step to highlight targets; mark one completed.
5. **Debug Mode** — Switch tabs. Scope shows **SIMULATED** badge. Connect SimTransport → Start 1 kS/s → Capture & Analyze (stats + history tagged `simulated`).
6. **RESET fault** — In assistant, enable **Demo fault: missing RESET**. Re-Auto-Set if needed. Capture again → stuck-low waveform. Click **Diagnose** → fixture/Gemini cites missing pin 4 → VCC. Confirm Probe (AI never starts ADC alone).
7. **Hardware honesty (15 s)** — Switch to Web Serial; explain UNO Q must use `Monitor` firmware under `firmware/uno-q/`; divider notes in `hardware/probe-frontend/`; no fake live data if disconnected.

## Talking points

- Electrical model is source of truth; DIP-8 pin map unit-tested.
- No full SPICE; behavioral sim for demo waveforms only.
- Measurement claim: 0–5 V via divider, ≥1 kS/s — not 100 kS/s.
