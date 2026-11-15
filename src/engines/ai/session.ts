import {
  executeTool,
  GEMINI_TOOL_DECLARATIONS,
  validateToolCall,
  type ToolContext,
  type ToolName,
} from './tools'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  at: number
}

export interface DiagnoseResult {
  mode: 'live' | 'fixture' | 'offline'
  messages: ChatMessage[]
  probeTarget?: {
    netId?: string
    componentId?: string
    pinId?: string
    holeId?: string
  }
  repairSuggestion?: unknown
}

/**
 * Run a diagnostic turn. Uses Gemini via /api/gemini proxy when available;
 * otherwise runs the deterministic missing-RESET fixture path.
 */
export async function runDiagnosis(
  userText: string,
  ctx: ToolContext,
): Promise<DiagnoseResult> {
  const messages: ChatMessage[] = [
    {
      id: `m_${Date.now()}`,
      role: 'user',
      content: userText,
      at: Date.now(),
    },
  ]

  // Always gather circuit context via validated tools first
  const circuitCtx = executeTool('get_circuit_context', {}, ctx)
  const history = executeTool('get_diagnostic_history', {}, ctx)
  const repair = executeTool('suggest_repair', {}, ctx)
  const verification = executeTool('request_verification', {}, ctx)

  const probe = executeTool(
    'request_probe_measurement',
    {
      netId:
        ctx.project.circuit.nets.find((n) => n.name === 'OUTPUT')?.id ??
        ctx.project.circuit.nets.find((n) => n.role === 'signal')?.id,
      maxVolts: 5,
    },
    ctx,
  ) as { target?: DiagnoseResult['probeTarget'] }

  // Try live Gemini
  try {
    const live = await callGemini(userText, circuitCtx, history, ctx)
    if (live) {
      messages.push({
        id: `m_${Date.now()}_a`,
        role: 'assistant',
        content: live,
        at: Date.now(),
      })
      return {
        mode: 'live',
        messages,
        probeTarget: probe.target,
        repairSuggestion: repair,
      }
    }
  } catch {
    /* fall through to fixture */
  }

  // Fixture / offline narration for hackathon demo
  const fault = ctx.intentionalFault === 'missing-reset'
  const content = fault
    ? [
        '**(Fixture diagnosis — Gemini key optional)**',
        '',
        'Circuit context loaded for the 555 astable LED blinker.',
        'Measurement pattern suggests OUTPUT stuck low (not blinking).',
        '',
        '**Hypothesis:** Missing RESET connection on pin 4.',
        'On the NE555, RESET (pin 4) must be tied to VCC for normal astable operation. If left floating or grounded, the output stays low.',
        '',
        '**Next steps:**',
        '1. Confirm probe on OUTPUT / LED anode (awaiting your Confirm Probe).',
        '2. Inspect pin 4 → VCC jumper on the breadboard.',
        '3. Restore RESET, then Capture & Analyze again to verify square-wave activity.',
        '',
        `Verification plan: ${JSON.stringify(verification)}`,
      ].join('\n')
    : [
        '**(Offline assistant)**',
        '',
        'No Gemini API key configured (set `GEMINI_API_KEY` in `.env.local`).',
        'Using local tools only against the circuit model.',
        '',
        `Context: ${JSON.stringify(circuitCtx)}`,
        '',
        `Suggestion: ${JSON.stringify(repair)}`,
      ].join('\n')

  messages.push({
    id: `m_${Date.now()}_a`,
    role: 'assistant',
    content,
    at: Date.now(),
  })

  return {
    mode: fault ? 'fixture' : 'offline',
    messages,
    probeTarget: probe.target,
    repairSuggestion: repair,
  }
}

async function callGemini(
  userText: string,
  circuitCtx: unknown,
  history: unknown,
  ctx: ToolContext,
): Promise<string | null> {
  // Probe availability with a lightweight generateContent via Vite proxy
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'You are Circuit Odyssey diagnostic assistant for a 555 LED blinker.',
              'Use only the provided circuit context. Never invent live scope data.',
              'Never request raw serial access. Safe probe range is 0–5 V via divider.',
              '',
              `Circuit context: ${JSON.stringify(circuitCtx)}`,
              `History: ${JSON.stringify(history)}`,
              `Intentional fault flag: ${ctx.intentionalFault ?? 'none'}`,
              '',
              `User: ${userText}`,
              '',
              'Respond with a short diagnosis hypothesis and actionable breadboard checks.',
            ].join('\n'),
          },
        ],
      },
    ],
  }

  const res = await fetch(
    '/api/gemini/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  return text ?? null
}

export function listTools(): typeof GEMINI_TOOL_DECLARATIONS {
  return GEMINI_TOOL_DECLARATIONS
}

export function safeExecute(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): unknown {
  const gate = validateToolCall(name, args)
  if (!gate.ok) return { error: gate.reason }
  return executeTool(name as ToolName, args, ctx)
}
