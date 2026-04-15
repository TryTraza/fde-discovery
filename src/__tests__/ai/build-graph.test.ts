import { describe, expect, it } from 'vitest'
import { buildGraphFromLegacyModel } from '@/lib/ai/graph/build-graph'
import { processGraphSchema } from '@/lib/ai/contracts'
import type { EdgeCase, ProcessStep, SystemEntry } from '@/lib/db/types'

function step(partial: Partial<ProcessStep> & { id: string; order: number; name: string }): ProcessStep {
  return {
    description: '',
    confidence: 'inferred',
    systems: [],
    nextSteps: [],
    relatedEdgeCases: [],
    notes: '',
    ...partial,
  }
}

describe('buildGraphFromLegacyModel', () => {
  it('produces a valid ProcessGraph for a minimal linear model', () => {
    const graph = buildGraphFromLegacyModel({
      steps: [
        step({ id: 's1', order: 1, name: 'Submit PO', nextSteps: ['s2'] }),
        step({ id: 's2', order: 2, name: 'Approve', confidence: 'confirmed' }),
      ],
      edgeCases: [],
      systems: [],
    })

    expect(processGraphSchema.safeParse(graph).success).toBe(true)
    expect(graph.schemaVersion).toBe(1)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].type).toBe('sequence')
  })

  it('maps branching steps to conditional edges with the branchCondition', () => {
    const graph = buildGraphFromLegacyModel({
      steps: [
        step({
          id: 's1',
          order: 1,
          name: 'Check price',
          nextSteps: ['s2', 's3'],
          branchCondition: 'price > $10k',
        }),
        step({ id: 's2', order: 2, name: 'Manual review' }),
        step({ id: 's3', order: 2, name: 'Auto approve' }),
      ],
      edgeCases: [],
      systems: [],
    })

    const branchEdges = graph.edges.filter((e) => e.from === 's1')
    expect(branchEdges).toHaveLength(2)
    for (const e of branchEdges) {
      expect(e.type).toBe('conditional')
      expect(e.condition).toBe('price > $10k')
    }
  })

  it('maps legacy confidence levels (missing → open_question)', () => {
    const graph = buildGraphFromLegacyModel({
      steps: [
        step({ id: 's1', order: 1, name: 'Unknown step', confidence: 'missing' }),
      ],
      edgeCases: [],
      systems: [],
    })
    expect(graph.nodes[0].confidence).toBe('open_question')
  })

  it('maps edge cases and collapses needs_clarification to open', () => {
    const edgeCases: EdgeCase[] = [
      {
        id: 'ec1',
        description: 'Rush PO',
        frequency: 'rare',
        suggestedHandling: 'Escalate',
        status: 'needs_clarification',
        relatedStepId: 's1',
      },
      {
        id: 'ec2',
        description: 'Resolved case',
        frequency: 'occasional',
        suggestedHandling: '',
        status: 'resolved',
      },
    ]
    const graph = buildGraphFromLegacyModel({
      steps: [step({ id: 's1', order: 1, name: 'Step' })],
      edgeCases,
      systems: [],
    })

    expect(graph.edgeCases).toHaveLength(2)
    expect(graph.edgeCases[0].status).toBe('open')
    expect(graph.edgeCases[0].affectedNodeIds).toEqual(['s1'])
    expect(graph.edgeCases[1].status).toBe('addressed')
    expect(graph.edgeCases[1].affectedNodeIds).toEqual([])
  })

  it('preserves systems on step metadata rather than creating system nodes', () => {
    const systems: SystemEntry[] = [
      {
        name: 'SAP',
        confirmed: true,
        role: 'PO system',
        details: '',
        gaps: '',
        detailNotes: 'main instance',
      },
    ]
    const graph = buildGraphFromLegacyModel({
      steps: [step({ id: 's1', order: 1, name: 'Submit', systems: ['SAP'] })],
      edgeCases: [],
      systems,
    })

    expect(graph.nodes.some((n) => n.type === 'system')).toBe(false)
    expect(graph.nodes[0].metadata.systems).toEqual(['SAP'])
  })

  it('is idempotent (stable ids, same output on re-run)', () => {
    const input = {
      steps: [step({ id: 's1', order: 1, name: 'Submit', nextSteps: ['s2'] }), step({ id: 's2', order: 2, name: 'Done' })],
      edgeCases: [],
      systems: [],
    }
    const a = buildGraphFromLegacyModel(input)
    const b = buildGraphFromLegacyModel(input)
    expect(a).toEqual(b)
  })
})
