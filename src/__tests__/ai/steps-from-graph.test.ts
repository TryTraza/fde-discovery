import { describe, expect, it } from 'vitest'
import { stepsFromGraph } from '@/lib/ai/graph/steps-from-graph'
import type { ProcessGraph } from '@/lib/ai/contracts'

function graph(partial: Partial<ProcessGraph>): ProcessGraph {
  return {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    edgeCases: [],
    ...partial,
  }
}

describe('stepsFromGraph', () => {
  it('returns an empty list for an empty graph', () => {
    expect(stepsFromGraph(graph({}))).toEqual([])
  })

  it('skips non-step nodes (terminal / system / artifact / decision)', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          { id: 't', type: 'terminal', label: 'Start', confidence: 'confirmed', metadata: {} },
          { id: 'sys', type: 'system', label: 'SAP', confidence: 'confirmed', metadata: {} },
          {
            id: 's1',
            type: 'step',
            label: 'Submit PO',
            confidence: 'confirmed',
            metadata: { order: 1 },
          },
        ],
      })
    )
    expect(out.map((s) => s.id)).toEqual(['s1'])
  })

  it('orders steps by metadata.order', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          {
            id: 's2',
            type: 'step',
            label: 'Approve',
            confidence: 'inferred',
            metadata: { order: 2 },
          },
          {
            id: 's1',
            type: 'step',
            label: 'Submit',
            confidence: 'confirmed',
            metadata: { order: 1 },
          },
        ],
      })
    )
    expect(out.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('falls back to insertion order when metadata.order is missing', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          { id: 'a', type: 'step', label: 'A', confidence: 'confirmed', metadata: {} },
          { id: 'b', type: 'step', label: 'B', confidence: 'inferred', metadata: {} },
        ],
      })
    )
    expect(out.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('maps confidence levels (open_question → missing, assumed → inferred)', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          {
            id: 'q',
            type: 'step',
            label: 'Unknown',
            confidence: 'open_question',
            metadata: { order: 1 },
          },
          {
            id: 'a',
            type: 'step',
            label: 'Guess',
            confidence: 'assumed',
            metadata: { order: 2 },
          },
        ],
      })
    )
    expect(out.find((s) => s.id === 'q')?.confidence).toBe('missing')
    expect(out.find((s) => s.id === 'a')?.confidence).toBe('inferred')
  })

  it('reads systems[] from metadata as legacy SystemEntry objects', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          {
            id: 's',
            type: 'step',
            label: 'Submit',
            confidence: 'confirmed',
            metadata: { order: 1, systems: ['SAP', 'Email'] },
          },
        ],
      })
    )
    expect(out[0].systems).toEqual([
      { name: 'SAP', confirmed: false, detailNotes: '' },
      { name: 'Email', confirmed: false, detailNotes: '' },
    ])
  })

  it('preserves notes and relatedEdgeCases from metadata', () => {
    const out = stepsFromGraph(
      graph({
        nodes: [
          {
            id: 's',
            type: 'step',
            label: 'Submit',
            description: 'Buyer submits',
            confidence: 'confirmed',
            metadata: {
              order: 1,
              notes: 'Watch for rush POs',
              relatedEdgeCases: ['ec1', 'ec2'],
            },
          },
        ],
      })
    )
    expect(out[0].description).toBe('Buyer submits')
    expect(out[0].notes).toBe('Watch for rush POs')
    expect(out[0].edgeCases).toEqual(['ec1', 'ec2'])
  })
})
