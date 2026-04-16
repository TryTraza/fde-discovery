import { describe, expect, it } from 'vitest'
import {
  companyProfileSchema,
  CONTRACT_SCHEMA_VERSION,
  processGraphSchema,
  processHypothesisSchema,
  researchNoteResultSchema,
  synthesisOutputSchema,
} from '@/lib/ai/contracts'
import {
  validCompanyProfile,
  validProcessGraph,
  validProcessHypothesis,
  validResearchNoteResult,
  validSynthesisOutput,
} from '@/lib/ai/contracts/__fixtures__'

describe('contracts: schemaVersion', () => {
  it('is pinned to 1', () => {
    expect(CONTRACT_SCHEMA_VERSION).toBe(1)
  })
})

describe('processGraphSchema', () => {
  it('accepts a valid fixture', () => {
    const parsed = processGraphSchema.safeParse(validProcessGraph)
    expect(parsed.success).toBe(true)
  })

  it('rejects wrong schemaVersion', () => {
    const parsed = processGraphSchema.safeParse({ ...validProcessGraph, schemaVersion: 2 })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown node type', () => {
    const parsed = processGraphSchema.safeParse({
      ...validProcessGraph,
      nodes: [
        {
          id: 'x',
          type: 'actor',
          label: 'Buyer',
          confidence: 'confirmed',
          metadata: {},
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown edge type', () => {
    const parsed = processGraphSchema.safeParse({
      ...validProcessGraph,
      edges: [{ id: 'e', from: 'n1', to: 'n2', type: 'escalation' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('fills node metadata with empty object when omitted', () => {
    const parsed = processGraphSchema.parse({
      ...validProcessGraph,
      nodes: [
        { id: 'n9', type: 'step', label: 'Draft', confidence: 'assumed' },
        ...validProcessGraph.nodes,
      ],
    })
    expect(parsed.nodes[0].metadata).toEqual({})
  })
})

describe('processHypothesisSchema', () => {
  it('accepts a valid fixture', () => {
    expect(processHypothesisSchema.safeParse(validProcessHypothesis).success).toBe(true)
  })

  it('requires a summary', () => {
    const parsed = processHypothesisSchema.safeParse({
      ...validProcessHypothesis,
      summary: '',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a non-ISO generatedAt', () => {
    const parsed = processHypothesisSchema.safeParse({
      ...validProcessHypothesis,
      generatedAt: 'yesterday',
    })
    expect(parsed.success).toBe(false)
  })

  it('defaults optional arrays to empty when omitted', () => {
    const minimal = {
      schemaVersion: 1,
      summary: 'x',
      triggers: [],
      stakeholders: [],
      assumptions: [],
      generatedAt: '2026-04-15T10:00:00.000Z',
    }
    const parsed = processHypothesisSchema.parse(minimal)
    expect(parsed.inputs).toEqual([])
    expect(parsed.outputs).toEqual([])
    expect(parsed.openQuestions).toEqual([])
  })
})

describe('companyProfileSchema', () => {
  it('accepts a valid fixture', () => {
    expect(companyProfileSchema.safeParse(validCompanyProfile).success).toBe(true)
  })

  it('rejects a malformed source url', () => {
    const parsed = companyProfileSchema.safeParse({
      ...validCompanyProfile,
      sources: [{ title: 'x', url: 'not-a-url' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown company stage', () => {
    const parsed = companyProfileSchema.safeParse({
      ...validCompanyProfile,
      size: { stage: 'unicorn' },
    })
    expect(parsed.success).toBe(false)
  })
})

describe('researchNoteResultSchema', () => {
  it('accepts a valid fixture', () => {
    expect(researchNoteResultSchema.safeParse(validResearchNoteResult).success).toBe(true)
  })

  it('rejects an unknown finding category', () => {
    const parsed = researchNoteResultSchema.safeParse({
      ...validResearchNoteResult,
      findings: [{ category: 'gossip', text: 'x', confidence: 'low' }],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('synthesisOutputSchema', () => {
  it('accepts a valid fixture', () => {
    expect(synthesisOutputSchema.safeParse(validSynthesisOutput).success).toBe(true)
  })

  it('rejects a graph patch with an unknown op', () => {
    const parsed = synthesisOutputSchema.safeParse({
      ...validSynthesisOutput,
      graphPatch: {
        ...validSynthesisOutput.graphPatch,
        nodes: [{ op: 'merge', node: { id: 'n2' } }],
      },
    })
    expect(parsed.success).toBe(false)
  })

  it('requires a node id on every patch', () => {
    const parsed = synthesisOutputSchema.safeParse({
      ...validSynthesisOutput,
      graphPatch: {
        ...validSynthesisOutput.graphPatch,
        nodes: [{ op: 'update', node: { label: 'x' } }],
      },
    })
    expect(parsed.success).toBe(false)
  })
})
