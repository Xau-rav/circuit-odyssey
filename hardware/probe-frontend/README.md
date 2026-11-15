# Probe front-end (UNO Q A0)

Arduino UNO Q analog inputs are **3.3 V referenced** and **not 5 V tolerant** in ADC mode.  
Circuit Odyssey MVP measures **0–5 V circuit-referred** only through this divider.

## BOM (MVP)

| Qty | Part | Notes |
|---|---|---|
| 1 | Probe tip / Dupont lead | To circuit node under test |
| 1 | GND clip / Dupont | **Must** share circuit GND with UNO Q GND |
| 1 | 10 kΩ resistor | Top of divider (from probe tip) |
| 1 | 20 kΩ resistor | Bottom of divider (to GND) — ≈ ÷1.5 → 5 V → 3.33 V |
| 1 | 1 kΩ series | Between divider mid and A0 |
| 1 | 100 nF ceramic | Midpoint to GND (noise / light anti-alias) |
| optional | 3.3 V Schottky/TVS to 3.3 V rail | Clamp; watch clamp current |

## Wiring

```
Probe tip ── 10k ──●── 20k ── GND (circuit + UNO Q)
                   │
                  100n
                   │
                  GND
                   │
                   └── 1k ── A0
```

## Calibration fields (app / firmware)

- `dividerRatio ≈ 1.5` (circuit V = ADC V × ratio)
- `vref ≈ 3.3`
- `gain`, `offset` for DMM trim

## Honesty limits

- Not CAT-rated; **no mains**
- MVP bandwidth: DC + LED blink rates
- Continuous stream target ≥ **1 kS/s** — not 100 kS/s until PoC
