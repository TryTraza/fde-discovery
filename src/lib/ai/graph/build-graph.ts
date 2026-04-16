import {
  processGraphSchema,
  type EdgeCase,
  type GraphEdge,
  type GraphNode,
  type NodeConfidence,
  type ProcessGraph,
} from '@/lib/ai/contracts'
import type {
  EdgeCase as LegacyEdgeCase,
  ProcessStep as LegacyProcessStep,
  SystemEntry as LegacySystemEntry,
} from '@/lib/db/types'

interface LegacyModelShape {
  steps: LegacyProcessStep[]
  edgeCases: LegacyEdgeCase[]
  systems: LegacySystemEntry[]
}

const CONFIDENCE_MAP: Record<LegacyProcessStep['confidence'], NodeConfidence> = {
  confirmed: 'confirmed',
  inferred: 'inferred',
  missing: 'open_question',
}

const EDGE_CASE_STATUS_MAP: Record<LegacyEdgeCase['status'], EdgeCase['status']> = {
  open: 'open',
  needs_clarification: 'open',
  resolved: 'addressed',
}

/**
 * Converts the legacy processModels shape (steps/edgeCases/systems)
 * into a typed ProcessGraph. Used by:
 *   - scripts/backfill-process-graph.ts for existing rows
 *   - apply-synthesis to keep graph in sync on every session apply
 *
 * Pure and deterministic so it's snapshot-testable.
 */
export function buildGraphFromLegacyModel(model: LegacyModelShape): ProcessGraph {
  const nodes: GraphNode[] = model.steps.map((step) => ({
    id: step.id,
    type: 'step',
    label: step.name,
    description: step.description || undefined,
    confidence: CONFIDENCE_MAP[step.confidence],
    metadata: {
      order: step.order,
      systems: Array.isArray(step.systems) ? step.systems : [],
      notes: step.notes || undefined,
      relatedEdgeCases: Array.isArray(step.relatedEdgeCases) ? step.relatedEdgeCases : [],
    },
    sourceSessionIds: step.sourceSessionId ? [step.sourceSessionId] : undefined,
  }))

  const edges: GraphEdge[] = []
  for (const step of model.steps) {
    // Defensive: hypothesis-generated steps don't carry nextSteps (no
    // ordering inference from a single AI pass). Treat as no outbound edges.
    const nextSteps = Array.isArray(step.nextSteps) ? step.nextSteps : []
    const isBranch = nextSteps.length > 1
    for (const target of nextSteps) {
      edges.push({
        id: `edge_${step.id}__${target}`,
        from: step.id,
        to: target,
        type: isBranch ? 'conditional' : 'sequence',
        condition: isBranch ? step.branchCondition ?? undefined : undefined,
        sourceSessionIds: step.sourceSessionId ? [step.sourceSessionId] : undefined,
      })
    }
  }

  const edgeCases: EdgeCase[] = model.edgeCases.map((legacy) => ({
    id: legacy.id,
    description: legacy.description,
    affectedNodeIds: legacy.relatedStepId ? [legacy.relatedStepId] : [],
    frequency: legacy.frequency,
    suggestedHandling: legacy.suggestedHandling || undefined,
    status: EDGE_CASE_STATUS_MAP[legacy.status],
    sourceSessionId: legacy.sourceSessionId,
  }))

  // Strip undefined keys so Zod's optional() branches accept the result cleanly.
  const graph: ProcessGraph = processGraphSchema.parse({
    schemaVersion: 1,
    nodes: nodes.map((n) => pruneUndefined(n)),
    edges: edges.map((e) => pruneUndefined(e)),
    edgeCases: edgeCases.map((ec) => pruneUndefined(ec)),
  })

  return graph
}

function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as T
}
