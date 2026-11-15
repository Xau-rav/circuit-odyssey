import { getDefinition } from '../../components/library/definitions'
import type {
  CircuitModel,
  MeasurementReport,
  Placement,
  ProjectFile,
} from '../../core/types'

export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'get_circuit_context',
    description: 'Compact circuit overview: components, nets, supplies, intent.',
  },
  {
    name: 'get_component_details',
    description: 'Details for one component including pins and placement.',
  },
  {
    name: 'get_net_connections',
    description: 'Members of a net and candidate breadboard holes.',
  },
  {
    name: 'get_breadboard_location',
    description: 'Map a component pin to its breadboard hole.',
  },
  {
    name: 'request_probe_measurement',
    description:
      'Highlight a probe target in the UI. Does NOT start ADC until the user confirms.',
  },
  {
    name: 'get_measurement_results',
    description: 'Return structured measurement report summaries.',
  },
  {
    name: 'compare_expected_behavior',
    description: 'Compare measurement stats to expected net behavior.',
  },
  {
    name: 'get_diagnostic_history',
    description: 'Prior diagnostic steps and notes.',
  },
  {
    name: 'suggest_repair',
    description: 'Propose a hypothesis and actionable check (no auto-edit).',
  },
  {
    name: 'request_verification',
    description: 'Post-repair measurement plan.',
  },
] as const

export type ToolName = (typeof GEMINI_TOOL_DECLARATIONS)[number]['name']

const ALLOWED = new Set(GEMINI_TOOL_DECLARATIONS.map((t) => t.name))

/** Hard reject unsafe / out-of-contract tools (AI cannot emit raw serial). */
export function validateToolCall(
  name: string,
  args: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED.has(name as ToolName)) {
    return { ok: false, reason: `Tool not allowed: ${name}` }
  }
  if (
    name === 'request_probe_measurement' &&
    typeof args.maxVolts === 'number' &&
    args.maxVolts > 5
  ) {
    return {
      ok: false,
      reason: 'Probe request exceeds safe 0–5 V MVP range (divider required).',
    }
  }
  const banned = ['serial', 'raw', 'firmware', 'baud', 'monitor_write']
  for (const key of Object.keys(args)) {
    if (banned.some((b) => key.toLowerCase().includes(b))) {
      return { ok: false, reason: `Argument key rejected: ${key}` }
    }
  }
  return { ok: true }
}

export interface ToolContext {
  project: ProjectFile
  placements: Placement[]
  measurements: MeasurementReport[]
  diagnosticNotes: string[]
  intentionalFault?: 'missing-reset' | 'none'
}

export function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext,
): unknown {
  const gate = validateToolCall(name, args)
  if (!gate.ok) return { error: gate.reason }

  const circuit = ctx.project.circuit

  switch (name) {
    case 'get_circuit_context':
      return {
        name: ctx.project.name,
        components: circuit.components.map((c) => ({
          id: c.id,
          refDes: c.refDes,
          type: c.type,
          value: c.value,
        })),
        nets: circuit.nets.map((n) => ({
          id: n.id,
          name: n.name,
          role: n.role,
          pins: n.pinRefs.length,
          expected: n.expected,
        })),
        intentionalFault: ctx.intentionalFault ?? 'none',
        intent: '555 astable LED blinker',
      }
    case 'get_component_details': {
      const id = String(args.componentId ?? args.refDes ?? '')
      const comp =
        circuit.components.find((c) => c.id === id || c.refDes === id) ?? null
      if (!comp) return { error: 'Component not found' }
      const def = getDefinition(comp.type)
      const placement = ctx.placements.find((p) => p.componentId === comp.id)
      return {
        ...comp,
        pinDefs: def.pins,
        placement,
      }
    }
    case 'get_net_connections': {
      const netId = String(args.netId ?? args.name ?? '')
      const net =
        circuit.nets.find((n) => n.id === netId || n.name === netId) ?? null
      if (!net) return { error: 'Net not found' }
      const holes: string[] = []
      for (const ref of net.pinRefs) {
        const p = ctx.placements.find((x) => x.componentId === ref.componentId)
        const h = p?.pinHoleMap[ref.pinId]
        if (h) holes.push(h)
      }
      return { net, candidateHoles: holes }
    }
    case 'get_breadboard_location': {
      const componentId = String(args.componentId ?? '')
      const pinId = String(args.pinId ?? args.pinName ?? '')
      const p = ctx.placements.find((x) => x.componentId === componentId)
      const comp = circuit.components.find((c) => c.id === componentId)
      let resolvedPin = pinId
      if (comp && pinId && !pinId.startsWith('p') && !['a', 'b', 'k', 'out'].includes(pinId)) {
        const def = getDefinition(comp.type)
        const match = def.pins.find(
          (pin) => pin.name.toLowerCase() === pinId.toLowerCase(),
        )
        if (match) resolvedPin = match.id
      }
      return {
        holeId: p?.pinHoleMap[resolvedPin] ?? null,
        pinHoleMap: p?.pinHoleMap ?? null,
      }
    }
    case 'request_probe_measurement':
      return {
        status: 'pending_user_confirm',
        target: {
          netId: args.netId ?? null,
          componentId: args.componentId ?? null,
          pinId: args.pinId ?? null,
          holeId: args.holeId ?? null,
        },
        message:
          'Probe target set. User must confirm before any ADC stream starts.',
      }
    case 'get_measurement_results':
      return ctx.measurements.map(summarizeReport)
    case 'compare_expected_behavior': {
      const netId = String(args.netId ?? '')
      const net = circuit.nets.find((n) => n.id === netId || n.name === netId)
      const report = ctx.measurements[ctx.measurements.length - 1]
      if (!net || !report) return { error: 'Need net and at least one measurement' }
      const expected = net.expected
      if (!expected) return { match: 'unknown', reason: 'No expected behavior on net' }
      if (expected.kind === 'square') {
        const blinking =
          (report.stats.pp ?? 0) > 2 &&
          (report.stats.freqHz ?? 0) > 0.2 &&
          (report.stats.freqConfidence ?? 0) > 0.3
        return {
          match: blinking ? 'likely' : 'unlikely',
          expected,
          observed: report.stats,
          source: report.source,
        }
      }
      if (expected.kind === 'dc') {
        const near =
          Math.abs((report.stats.mean ?? 0) - (expected.approxMean ?? 0)) < 0.5
        return {
          match: near ? 'likely' : 'unlikely',
          expected,
          observed: report.stats,
          source: report.source,
        }
      }
      return { match: 'unknown', expected, observed: report.stats }
    }
    case 'get_diagnostic_history':
      return { notes: ctx.diagnosticNotes, measurements: ctx.measurements.map(summarizeReport) }
    case 'suggest_repair':
      return suggestRepair(circuit, ctx)
    case 'request_verification':
      return {
        plan: [
          'Confirm RESET net is tied to VCC on the breadboard.',
          'Probe OUTPUT (pin 3) or LED anode net.',
          'Capture & Analyze — expect square ~few Hz if healthy; stuck low if RESET floating/low.',
          'Re-run compare_expected_behavior on OUTPUT net.',
        ],
      }
    default:
      return { error: 'Unhandled tool' }
  }
}

function summarizeReport(r: MeasurementReport) {
  return {
    id: r.id,
    source: r.source,
    stats: r.stats,
    sampleRateHz: r.sampleRateHz,
    channel: r.adc.channel,
    startedAt: r.startedAt,
    quality: r.quality,
  }
}

function suggestRepair(circuit: CircuitModel, ctx: ToolContext) {
  const resetNet = circuit.nets.find(
    (n) =>
      n.name?.toLowerCase() === 'reset' ||
      n.pinRefs.some((ref) => {
        const c = circuit.components.find((x) => x.id === ref.componentId)
        return c?.type === 'ne555' && ref.pinId === 'p4'
      }),
  )
  const last = ctx.measurements[ctx.measurements.length - 1]
  const stuckLow =
    last && last.stats.pp < 0.5 && last.stats.mean < 0.5

  if (ctx.intentionalFault === 'missing-reset' || stuckLow) {
    return {
      hypothesis: 'Missing or floating RESET (555 pin 4)',
      confidence: 0.85,
      checks: [
        'Verify pin 4 (RESET) has a jumper to VCC.',
        'Measure RESET net — should be logic high (~VCC), not floating/low.',
        'If RESET was omitted for the demo fault, restore the wire and re-measure OUTPUT.',
      ],
      relatedNetId: resetNet?.id ?? null,
      autoEdit: false,
    }
  }
  return {
    hypothesis: 'Insufficient evidence — capture OUTPUT and RESET before concluding',
    confidence: 0.4,
    checks: [
      'Run request_probe_measurement on OUTPUT.',
      'Confirm power rails and LED orientation.',
    ],
    autoEdit: false,
  }
}
