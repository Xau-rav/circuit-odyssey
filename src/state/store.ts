import { create } from 'zustand'
import { build830Breadboard } from '../breadboard/geometry'
import {
  generateAssemblySteps,
  reviseAffectedSteps,
  setStepStatus,
} from '../engines/assembly'
import { analyzeWaveform } from '../engines/measurement/analysis'
import { SimTransport } from '../engines/measurement/transports/SimTransport'
import { WebSerialTransport } from '../engines/measurement/transports/WebSerialTransport'
import type { MeasurementTransport } from '../engines/measurement/transports/types'
import { autoSetPlacements } from '../engines/placement'
import { validatePlacementAttempt } from '../engines/placement/validate'
import {
  fitWires,
  generateWires,
  markAffectedWires,
} from '../engines/routing'
import { runDiagnosis, type ChatMessage } from '../engines/ai/session'
import { createId } from '../core/ids'
import type {
  AppMode,
  AssemblyStatus,
  MeasurementReport,
  Placement,
  ProjectFile,
  Rotation,
  Wire,
} from '../core/types'
import { create555BlinkerProject } from '../demo/blinker555'
import { downloadProject, parseProject, serializeProject } from '../storage/projectFormat'
import { loadProjectFromIdb, saveProjectToIdb } from '../storage/idb'

const board = build830Breadboard()
const PROJECT_KEY = 'current'

export type TransportKind = 'sim' | 'webserial'

interface HistoryEntry {
  project: ProjectFile
}

interface OdysseyState {
  mode: AppMode
  project: ProjectFile
  projectId: string
  selectedIds: string[]
  highlightedIds: string[]
  board: typeof board
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  transportKind: TransportKind
  transport: MeasurementTransport
  sim: SimTransport
  connectionState: string
  liveBuffer: number[]
  lastStats: ReturnType<typeof analyzeWaveform> | null
  measurementHistory: MeasurementReport[]
  probeTarget: {
    netId?: string
    componentId?: string
    pinId?: string
    holeId?: string
  } | null
  probeConfirmed: boolean
  intentionalFault: 'none' | 'missing-reset'
  chat: ChatMessage[]
  aiBusy: boolean
  aiMode: 'live' | 'fixture' | 'offline' | null
  scopeHeight: number
  panelWidth: number
  streaming: boolean
  /** Session-only: show jumper wires on the board */
  showWires: boolean
  /** Component currently dragged from tray / board (for DnD) */
  dragComponentId: string | null
  /** Breadboard status line (template `#status`) */
  boardStatus: { message: string; error: boolean }

  setMode: (mode: AppMode) => void
  setShowWires: (show: boolean) => void
  setDragComponentId: (id: string | null) => void
  setBoardStatus: (message: string, error?: boolean) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  load555: (omitReset?: boolean) => void
  autoSet: () => void
  fitWires: () => void
  generateWires: () => void
  select: (ids: string[]) => void
  highlight: (ids: string[]) => void
  moveComponent: (componentId: string, anchorHoleId: string) => void
  rotateSelected: () => void
  removeSelected: () => void
  setAssemblyStatus: (stepId: string, status: AssemblyStatus) => void
  setTransport: (kind: TransportKind) => Promise<void>
  connectTransport: () => Promise<void>
  disconnectTransport: () => Promise<void>
  startStream: () => Promise<void>
  stopStream: () => Promise<void>
  captureAnalyze: () => Promise<void>
  setProbeTarget: (t: OdysseyState['probeTarget']) => void
  confirmProbe: () => void
  setFault: (f: 'none' | 'missing-reset') => void
  diagnose: (text: string) => Promise<void>
  saveIdb: () => Promise<void>
  loadIdb: () => Promise<void>
  exportJson: () => void
  importJson: (json: string) => void
  setScopeHeight: (h: number) => void
  setPanelWidth: (w: number) => void
  snapshotProject: () => ProjectFile
}

function withAssembly(project: ProjectFile): ProjectFile {
  const assembly = generateAssemblySteps(
    project.circuit,
    project.breadboard.placements,
    project.breadboard.wires,
  )
  return { ...project, assembly }
}

function cloneProject(p: ProjectFile): ProjectFile {
  return JSON.parse(serializeProject(p)) as ProjectFile
}

export const useStore = create<OdysseyState>((set, get) => {
  const sim = new SimTransport()
  const initial = withAssembly(create555BlinkerProject())

  return {
    mode: 'build',
    project: initial,
    projectId: PROJECT_KEY,
    selectedIds: [],
    highlightedIds: [],
    board,
    undoStack: [],
    redoStack: [],
    transportKind: 'sim',
    transport: sim,
    sim,
    connectionState: 'disconnected',
    liveBuffer: [],
    lastStats: null,
    measurementHistory: [],
    probeTarget: null,
    probeConfirmed: false,
    intentionalFault: 'none',
    chat: [],
    aiBusy: false,
    aiMode: null,
    scopeHeight: 280,
    panelWidth: 340,
    streaming: false,
    showWires: true,
    dragComponentId: null,
    boardStatus: {
      message: 'Select or drag a part to begin.',
      error: false,
    },

    setMode: (mode) => set({ mode }),
    setShowWires: (show) => set({ showWires: show }),
    setDragComponentId: (id) => set({ dragComponentId: id }),
    setBoardStatus: (message, error = false) =>
      set({ boardStatus: { message, error } }),

    pushHistory: () => {
      const { project, undoStack } = get()
      set({
        undoStack: [...undoStack.slice(-49), { project: cloneProject(project) }],
        redoStack: [],
      })
    },

    undo: () => {
      const { undoStack, redoStack, project } = get()
      const prev = undoStack[undoStack.length - 1]
      if (!prev) return
      set({
        project: prev.project,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, { project: cloneProject(project) }],
      })
    },

    redo: () => {
      const { undoStack, redoStack, project } = get()
      const next = redoStack[redoStack.length - 1]
      if (!next) return
      set({
        project: next.project,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, { project: cloneProject(project) }],
      })
    },

    load555: (omitReset = false) => {
      get().pushHistory()
      const project = withAssembly(create555BlinkerProject({ omitReset }))
      get().sim.setFaultMode(omitReset ? 'missing-reset' : 'none')
      set({
        project,
        intentionalFault: omitReset ? 'missing-reset' : 'none',
        selectedIds: [],
        highlightedIds: [],
        measurementHistory: [],
        chat: [],
      })
    },

    autoSet: () => {
      get().pushHistory()
      const { project } = get()
      const placements = autoSetPlacements(board, project.circuit.components)
      if (!placements.length) {
        set({
          boardStatus: {
            message: 'Auto-set ran out of space.',
            error: true,
          },
        })
        return
      }
      const wires = generateWires(
        board,
        project.circuit,
        placements,
        [],
      )
      const next = withAssembly({
        ...project,
        breadboard: { ...project.breadboard, placements, wires },
      })
      set({
        project: next,
        boardStatus: {
          message: `Placed ${placements.length} parts and ${wires.filter((w) => w.valid).length} jumpers.`,
          error: false,
        },
      })
    },

    generateWires: () => {
      get().pushHistory()
      const { project } = get()
      const wires = generateWires(
        board,
        project.circuit,
        project.breadboard.placements,
        project.breadboard.wires.filter((w) => w.valid),
      )
      set({
        project: withAssembly({
          ...project,
          breadboard: { ...project.breadboard, wires },
        }),
      })
    },

    fitWires: () => {
      get().pushHistory()
      const { project } = get()
      const wires = fitWires(
        board,
        project.circuit,
        project.breadboard.placements,
        project.breadboard.wires,
      )
      set({
        project: withAssembly({
          ...project,
          breadboard: { ...project.breadboard, wires },
        }),
      })
    },

    select: (ids) => {
      const { project } = get()
      const ref = project.circuit.components.find((c) => c.id === ids[0])?.refDes
      set({
        selectedIds: ids,
        boardStatus: ref
          ? {
              message: `Selected ${ref}. Choose an anchor hole.`,
              error: false,
            }
          : get().boardStatus,
      })
    },
    highlight: (ids) => set({ highlightedIds: ids }),

    moveComponent: (componentId, anchorHoleId) => {
      const { project } = get()
      const comp = project.circuit.components.find((c) => c.id === componentId)
      if (!comp) {
        set({
          boardStatus: { message: 'Select a part first.', error: true },
        })
        return
      }

      const result = validatePlacementAttempt(
        board,
        project,
        comp,
        anchorHoleId,
        comp.rotation,
      )
      if (!result.ok) {
        set({ boardStatus: { message: result.reason, error: true } })
        return
      }
      const placement = result.placement

      get().pushHistory()
      const old = project.breadboard.placements.find(
        (p) => p.componentId === componentId,
      )
      const affected = [
        ...(old?.occupiedHoleIds ?? []),
        ...placement.occupiedHoleIds,
      ]
      const placements = [
        ...project.breadboard.placements.filter((p) => p.componentId !== componentId),
        placement,
      ]
      const wires = markAffectedWires(project.breadboard.wires, affected)
      const assembly = reviseAffectedSteps(project.assembly, [
        componentId,
        ...wires.map((w) => w.id),
      ])
      set({
        project: {
          ...project,
          breadboard: { ...project.breadboard, placements, wires },
          assembly,
          circuit: {
            ...project.circuit,
            components: project.circuit.components.map((c) =>
              c.id === componentId
                ? { ...c, placement: { anchorHoleId } }
                : c,
            ),
          },
        },
        boardStatus: {
          message: `${comp.refDes} placed at ${anchorHoleId}.`,
          error: false,
        },
        selectedIds: [componentId],
      })
    },

    rotateSelected: () => {
      const { selectedIds, project } = get()
      const id = selectedIds[0]
      if (!id) return
      const comp = project.circuit.components.find((c) => c.id === id)
      if (!comp) return
      if (comp.type === 'vcc' || comp.type === 'gnd') return
      get().pushHistory()
      // DIP: template Rotate 180°; passives: 90° steps
      const nextRot = (
        comp.type === 'ne555'
          ? comp.rotation === 0
            ? 180
            : 0
          : (comp.rotation + 90) % 360
      ) as Rotation
      const existing = project.breadboard.placements.find((p) => p.componentId === id)
      let placements = project.breadboard.placements
      let wires: Wire[] = project.breadboard.wires
      if (existing) {
        const check = validatePlacementAttempt(
          board,
          {
            ...project,
            breadboard: {
              ...project.breadboard,
              placements: project.breadboard.placements.filter(
                (p) => p.componentId !== id,
              ),
            },
          },
          { ...comp, rotation: nextRot },
          existing.anchorHoleId,
          nextRot,
        )
        if (!check.ok) {
          set({ boardStatus: { message: check.reason, error: true } })
          return
        }
        placements = [
          ...placements.filter((p) => p.componentId !== id),
          check.placement,
        ]
        wires = markAffectedWires(wires, [
          ...existing.occupiedHoleIds,
          ...check.placement.occupiedHoleIds,
        ])
      }
      set({
        project: {
          ...project,
          circuit: {
            ...project.circuit,
            components: project.circuit.components.map((c) =>
              c.id === id ? { ...c, rotation: nextRot } : c,
            ),
          },
          breadboard: { ...project.breadboard, placements, wires },
          assembly: reviseAffectedSteps(project.assembly, [id]),
        },
        boardStatus: {
          message: `${comp.refDes} rotated ${comp.type === 'ne555' ? '180°' : '90°'}.`,
          error: false,
        },
      })
    },

    removeSelected: () => {
      const { selectedIds, project } = get()
      const id = selectedIds[0]
      if (!id) return
      const existing = project.breadboard.placements.find((p) => p.componentId === id)
      if (!existing) return
      const ref =
        project.circuit.components.find((c) => c.id === id)?.refDes ?? id
      get().pushHistory()
      const wires = markAffectedWires(
        project.breadboard.wires,
        existing.occupiedHoleIds,
      )
      set({
        project: {
          ...project,
          breadboard: {
            ...project.breadboard,
            placements: project.breadboard.placements.filter(
              (p) => p.componentId !== id,
            ),
            wires,
          },
          assembly: reviseAffectedSteps(project.assembly, [id]),
          circuit: {
            ...project.circuit,
            components: project.circuit.components.map((c) =>
              c.id === id ? { ...c, placement: undefined } : c,
            ),
          },
        },
        boardStatus: {
          message: `${ref} moved back to the tray.`,
          error: false,
        },
      })
    },

    setAssemblyStatus: (stepId, status) => {
      const { project } = get()
      set({
        project: {
          ...project,
          assembly: setStepStatus(project.assembly, stepId, status),
        },
      })
      const step = project.assembly.find((s) => s.id === stepId)
      if (step) set({ highlightedIds: step.targetIds })
    },

    setTransport: async (kind) => {
      const { transport, streaming } = get()
      if (streaming) await get().stopStream()
      await transport.disconnect().catch(() => undefined)
      const next: MeasurementTransport =
        kind === 'sim' ? get().sim : new WebSerialTransport()
      set({
        transportKind: kind,
        transport: next,
        connectionState: next.getConnectionState(),
        liveBuffer: [],
      })
    },

    connectTransport: async () => {
      const { transport } = get()
      set({ connectionState: 'connecting' })
      try {
        await transport.connect()
        set({ connectionState: transport.getConnectionState() })
        transport.onData((batch) => {
          set((s) => ({
            liveBuffer: [...s.liveBuffer, ...batch.volts].slice(-4000),
          }))
        })
      } catch (e) {
        set({
          connectionState: transport.getConnectionState(),
        })
        throw e
      }
    },

    disconnectTransport: async () => {
      await get().stopStream()
      await get().transport.disconnect()
      set({ connectionState: get().transport.getConnectionState() })
    },

    startStream: async () => {
      const { transport, probeConfirmed, transportKind } = get()
      if (transportKind === 'webserial' && !probeConfirmed) {
        throw new Error('Confirm probe before starting physical stream')
      }
      await transport.startStream('A0', 1000)
      set({ streaming: true, connectionState: transport.getConnectionState() })
    },

    stopStream: async () => {
      await get().transport.stopStream()
      set({ streaming: false, connectionState: get().transport.getConnectionState() })
    },

    captureAnalyze: async () => {
      const { transport, project, probeTarget, liveBuffer, transportKind } = get()
      let volts: number[]
      let source = transport.source
      let sampleRateHz = 1000
      if (liveBuffer.length > 64) {
        volts = liveBuffer.slice(-1000)
      } else {
        const batch = await transport.capture(1000, 1000)
        volts = batch.volts
        source = batch.source
        sampleRateHz = batch.sampleRateHz
      }
      const stats = analyzeWaveform(volts, sampleRateHz)
      const report: MeasurementReport = {
        id: createId('meas'),
        projectId: get().projectId,
        netId: probeTarget?.netId,
        componentId: probeTarget?.componentId,
        pinId: probeTarget?.pinId,
        holeId: probeTarget?.holeId,
        reference: 'gnd',
        source,
        adc: {
          resolutionBits: 14,
          vref: 3.3,
          channel: 'A0',
        },
        sampleRateHz,
        startedAt: new Date().toISOString(),
        calibration: {
          gain: 1,
          offset: 0,
          dividerRatio: 1.5,
        },
        stats,
        samples: volts,
        quality: {
          droppedSamples: 0,
          clipping: stats.max > 4.95,
          notes: [
            transportKind === 'sim'
              ? 'Source: SimTransport (simulated) — not physical hardware'
              : 'Source: physical Web Serial',
          ],
        },
      }
      set({
        lastStats: stats,
        liveBuffer: volts,
        measurementHistory: [...get().measurementHistory, report],
        project: {
          ...project,
          diagnostics: {
            notes: [
              ...(project.diagnostics?.notes ?? []),
              `Capture ${report.id} source=${source}`,
            ],
          },
        },
      })
    },

    setProbeTarget: (t) => set({ probeTarget: t, probeConfirmed: false }),
    confirmProbe: () => set({ probeConfirmed: true }),

    setFault: (f) => {
      get().sim.setFaultMode(f)
      set({ intentionalFault: f })
    },

    diagnose: async (text) => {
      set({ aiBusy: true })
      try {
        const result = await runDiagnosis(text, {
          project: get().snapshotProject(),
          placements: get().project.breadboard.placements,
          measurements: get().measurementHistory,
          diagnosticNotes: get().project.diagnostics?.notes ?? [],
          intentionalFault: get().intentionalFault,
        })
        set((s) => ({
          chat: [...s.chat, ...result.messages],
          aiMode: result.mode,
          probeTarget: result.probeTarget ?? s.probeTarget,
          probeConfirmed: false,
          highlightedIds: result.probeTarget?.holeId
            ? [result.probeTarget.holeId]
            : result.probeTarget?.componentId
              ? [result.probeTarget.componentId]
              : s.highlightedIds,
        }))
      } finally {
        set({ aiBusy: false })
      }
    },

    saveIdb: async () => {
      await saveProjectToIdb(get().projectId, get().snapshotProject())
    },

    loadIdb: async () => {
      const p = await loadProjectFromIdb(get().projectId)
      if (p) set({ project: p })
    },

    exportJson: () => downloadProject(get().snapshotProject()),

    importJson: (json) => {
      get().pushHistory()
      set({ project: withAssembly(parseProject(json)) })
    },

    setScopeHeight: (h) => set({ scopeHeight: Math.max(160, Math.min(520, h)) }),
    setPanelWidth: (w) => set({ panelWidth: Math.max(260, Math.min(520, w)) }),

    snapshotProject: () => cloneProject(get().project),
  }
})

export type { Placement }
