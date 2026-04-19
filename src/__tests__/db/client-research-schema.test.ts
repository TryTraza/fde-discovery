import { describe, expect, it } from 'vitest'
import { clientResearch, type ClientResearch, type NewClientResearch } from '@/lib/db/schema'
import { validClientResearch } from '@/lib/ai/contracts/__fixtures__'

describe('clientResearch table', () => {
  it('has a clientId primary key', () => {
    const col = clientResearch.clientId
    expect(col).toBeDefined()
    expect(col.name).toBe('client_id')
    expect(col.primary).toBe(true)
  })

  it('declares all expected columns', () => {
    const cols = Object.keys(clientResearch)
    const expected = [
      'clientId',
      'companyOverview',
      'sizeFinancials',
      'customersMarkets',
      'painPoints',
      'recentNews',
      'fitScore',
      'fitScoreRationale',
      'areasOfExpertise',
      'productsAndServices',
      'keyStakeholders',
      'techStack',
      'researchSources',
      'researchedAt',
      'schemaVersion',
      'createdAt',
      'updatedAt',
    ]
    for (const c of expected) expect(cols).toContain(c)
  })

  it('declares jsonb array columns as jsonb', () => {
    expect(clientResearch.areasOfExpertise.dataType).toBe('json')
    expect(clientResearch.productsAndServices.dataType).toBe('json')
    expect(clientResearch.keyStakeholders.dataType).toBe('json')
    expect(clientResearch.techStack.dataType).toBe('json')
    expect(clientResearch.researchSources.dataType).toBe('json')
  })

  it('NewClientResearch type accepts the valid fixture shape', () => {
    const candidate: NewClientResearch = {
      clientId: '00000000-0000-0000-0000-000000000000',
      companyOverview: validClientResearch.companyOverview,
      fitScore: validClientResearch.fitScore,
      areasOfExpertise: validClientResearch.areasOfExpertise,
      productsAndServices: validClientResearch.productsAndServices,
      keyStakeholders: validClientResearch.keyStakeholders,
      techStack: validClientResearch.techStack,
      researchSources: validClientResearch.researchSources,
      researchedAt: new Date(validClientResearch.researchedAt),
      schemaVersion: validClientResearch.schemaVersion,
    }
    expect(candidate.clientId).toBeDefined()
  })

  it('ClientResearch select type is inferable', () => {
    const _example: ClientResearch = {
      clientId: '00000000-0000-0000-0000-000000000000',
      companyOverview: null,
      sizeFinancials: null,
      customersMarkets: null,
      painPoints: null,
      recentNews: null,
      fitScore: null,
      fitScoreRationale: null,
      areasOfExpertise: [],
      productsAndServices: [],
      keyStakeholders: [],
      techStack: [],
      researchSources: [],
      researchedAt: null,
      schemaVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(_example.clientId).toBeDefined()
  })
})
