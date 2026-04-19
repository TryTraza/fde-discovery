import { describe, expect, it } from 'vitest'
import {
  clientResearchSchema,
  generatedClientResearchSchema,
  CONTRACT_SCHEMA_VERSION,
  type ClientResearchPayload,
  type GeneratedClientResearch,
} from '@/lib/ai/contracts'
import {
  validClientResearch,
  validGeneratedClientResearch,
} from '@/lib/ai/contracts/__fixtures__'

describe('clientResearchSchema', () => {
  it('accepts the valid fixture', () => {
    const parsed = clientResearchSchema.safeParse(validClientResearch)
    expect(parsed.success).toBe(true)
  })

  it('accepts a minimal payload with only required fields', () => {
    const minimal: ClientResearchPayload = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      researchedAt: '2026-04-15T10:00:00.000Z',
      areasOfExpertise: [],
      productsAndServices: [],
      keyStakeholders: [],
      techStack: [],
      researchSources: [],
    }
    expect(clientResearchSchema.safeParse(minimal).success).toBe(true)
  })

  it('defaults researchSources to [] when omitted', () => {
    const parsed = clientResearchSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      researchedAt: '2026-04-15T10:00:00.000Z',
      areasOfExpertise: [],
      productsAndServices: [],
      keyStakeholders: [],
      techStack: [],
    })
    expect(parsed.researchSources).toEqual([])
  })

  it('rejects schemaVersion other than CONTRACT_SCHEMA_VERSION', () => {
    const parsed = clientResearchSchema.safeParse({ ...validClientResearch, schemaVersion: 2 })
    expect(parsed.success).toBe(false)
  })

  it('rejects a non-ISO researchedAt', () => {
    const parsed = clientResearchSchema.safeParse({ ...validClientResearch, researchedAt: 'yesterday' })
    expect(parsed.success).toBe(false)
  })

  it('rejects a malformed source URL', () => {
    const parsed = clientResearchSchema.safeParse({
      ...validClientResearch,
      researchSources: [{ title: 'Acme', url: 'not-a-url' }],
    })
    expect(parsed.success).toBe(false)
  })

  describe('fitScore bounds', () => {
    it('accepts 1', () => {
      const parsed = clientResearchSchema.safeParse({ ...validClientResearch, fitScore: 1 })
      expect(parsed.success).toBe(true)
    })

    it('accepts 10', () => {
      const parsed = clientResearchSchema.safeParse({ ...validClientResearch, fitScore: 10 })
      expect(parsed.success).toBe(true)
    })

    it('rejects 0', () => {
      const parsed = clientResearchSchema.safeParse({ ...validClientResearch, fitScore: 0 })
      expect(parsed.success).toBe(false)
    })

    it('rejects 11', () => {
      const parsed = clientResearchSchema.safeParse({ ...validClientResearch, fitScore: 11 })
      expect(parsed.success).toBe(false)
    })

    it('rejects a non-integer', () => {
      const parsed = clientResearchSchema.safeParse({ ...validClientResearch, fitScore: 5.5 })
      expect(parsed.success).toBe(false)
    })
  })
})

describe('generatedClientResearchSchema', () => {
  it('accepts the valid fixture', () => {
    expect(generatedClientResearchSchema.safeParse(validGeneratedClientResearch).success).toBe(true)
  })

  it('requires the anchor fields but leaves optional fields undefined when omitted', () => {
    // Anchor fields (companyOverview, fitScore, fitScoreRationale,
    // areasOfExpertise, productsAndServices, techStack) give Anthropic's
    // grammar compiler a required backbone — all-optional schemas trip
    // "Grammar compilation timed out". Optional fields stay optional and
    // come back undefined when omitted.
    const parsed = generatedClientResearchSchema.parse({
      companyOverview: 'A company.',
      fitScore: 5,
      fitScoreRationale: 'Mid.',
      areasOfExpertise: [],
      productsAndServices: [],
      techStack: [],
    })
    expect(parsed.sizeFinancials).toBeUndefined()
    expect(parsed.customersMarkets).toBeUndefined()
    expect(parsed.keyStakeholders).toBeUndefined()
  })

  it('strips unknown fields the model may emit accidentally', () => {
    const parsed = generatedClientResearchSchema.parse({
      companyOverview: 'A company.',
      fitScore: 5,
      fitScoreRationale: 'Mid.',
      areasOfExpertise: [],
      productsAndServices: [],
      techStack: [],
      // model-leaked fields — must not appear on the parsed output
      schemaVersion: 999,
      researchedAt: '2026-04-15T10:00:00.000Z',
      researchSources: [{ title: 'Leaked', url: 'https://leaked.example.com' }],
    } as unknown as GeneratedClientResearch)
    expect(parsed).not.toHaveProperty('schemaVersion')
    expect(parsed).not.toHaveProperty('researchedAt')
    expect(parsed).not.toHaveProperty('researchSources')
  })

  it('accepts a fitScore without min/max constraints (enforced on persisted schema)', () => {
    // The generated schema must not constrain fitScore — Anthropic
    // structured outputs reject `minimum`/`maximum`. Bounds live on
    // clientResearchSchema only.
    const base = {
      companyOverview: 'A company.',
      fitScoreRationale: 'Mid.',
      areasOfExpertise: [],
      productsAndServices: [],
      techStack: [],
    }
    expect(generatedClientResearchSchema.safeParse({ ...base, fitScore: 0 }).success).toBe(true)
    expect(generatedClientResearchSchema.safeParse({ ...base, fitScore: 42 }).success).toBe(true)
  })
})
