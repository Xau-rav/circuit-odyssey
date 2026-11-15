import type { MeasurementStats } from '../../core/types'

export function analyzeWaveform(
  samples: number[],
  sampleRateHz: number,
): MeasurementStats {
  if (!samples.length) {
    return { mean: 0, min: 0, max: 0, pp: 0 }
  }
  let min = samples[0]!
  let max = samples[0]!
  let sum = 0
  let sumSq = 0
  for (const v of samples) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    sumSq += v * v
  }
  const mean = sum / samples.length
  const rms = Math.sqrt(sumSq / samples.length)
  const pp = max - min

  const { freqHz, freqConfidence } = estimateFrequency(samples, sampleRateHz, mean)

  return { mean, min, max, pp, rms, freqHz, freqConfidence }
}

function estimateFrequency(
  samples: number[],
  sampleRateHz: number,
  mean: number,
): { freqHz?: number; freqConfidence?: number } {
  if (samples.length < 8 || sampleRateHz <= 0) return {}
  const crossings: number[] = []
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]! - mean
    const b = samples[i]! - mean
    if (a <= 0 && b > 0) crossings.push(i)
  }
  if (crossings.length < 2) return { freqConfidence: 0 }
  const periods: number[] = []
  for (let i = 1; i < crossings.length; i++) {
    periods.push(crossings[i]! - crossings[i - 1]!)
  }
  const avgPeriod = periods.reduce((s, p) => s + p, 0) / periods.length
  const freqHz = sampleRateHz / avgPeriod
  const variance =
    periods.reduce((s, p) => s + (p - avgPeriod) ** 2, 0) / periods.length
  const cv = Math.sqrt(variance) / avgPeriod
  const freqConfidence = Math.max(0, Math.min(1, 1 - cv))
  return { freqHz, freqConfidence }
}
