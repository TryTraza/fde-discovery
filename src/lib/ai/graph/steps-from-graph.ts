import type { ProcessGraph, NodeConfidence } from '@/lib/ai/contracts'
import type { ProcessStepParsed } from '@/lib/validations/process'

const CONFIDENCE_MAP: Record<NodeConfidence, ProcessStepParsed['confidence']> = {
  confirmed: 'confirmed',
  inferred: 'inferred',
  assumed: 'inferred',
  open_question: 'missing',
}

/**
 * Adapter: ProcessGraph → ProcessStepParsed[].
 *
 * Inverse of buildGraphFromLegacyModel. Only `step` nodes contribute (system
 * / artifact / decision / terminal nodes are display-only and not editable
 * by the legacy step editor — they ride along on the graph but the editor
 * leaves them alone). Step ordering comes from `metadata.order`; falls back
 * to insertion order so a graph without explicit order still renders.
 *
 * Used by the process-flow component so the renderer pulls from
 * processModels.graph (the new source of truth) while keeping the existing
 * editor intact during the transition.
 */
export function stepsFromGraph(graph: ProcessGraph): ProcessStepParsed[] {
  const steps = graph.nodes
    .filter((n) => n.type === 'step')
    .map((n, fallbackIdx) => {
      const md = n.metadata ?? {}
      const order = typeof md.order === 'number' ? md.order : fallbackIdx + 1
      const systems = Array.isArray(md.systems)
        ? md.systems.filter((s): s is string => typeof s === 'string')
        : []
      const notes = typeof md.notes === 'string' ? md.notes : ''
      const relatedEdgeCases = Array.isArray(md.relatedEdgeCases)
        ? md.relatedEdgeCases.filter((s): s is string => typeof s === 'string')
        : []

      return {
        id: n.id,
        name: n.label,
        description: n.description ?? '',
        order,
        systems: systems.map((name) => ({ name, confirmed: false, detailNotes: '' })),
        confidence: CONFIDENCE_MAP[n.confidence],
        edgeCases: relatedEdgeCases,
        notes,
      } satisfies ProcessStepParsed
    })

  steps.sort((a, b) => a.order - b.order)
  return steps
}
