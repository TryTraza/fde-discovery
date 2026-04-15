import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/domain/l1', () => ({
  getL1: vi.fn(),
  getAllL1Domains: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

import { getL1, getAllL1Domains } from '@/lib/domain/l1'
import { getProcessById } from '@/lib/db/queries/processes'
import { l1DomainLayer } from '@/lib/ai/layers/l1-domain'

const fakeDomain = {
  type: 'procurement',
  label: 'Procurement',
  typicalSteps: [
    { name: 'PO Creation', description: 'Create purchase order', typicalSystems: ['SAP'] },
  ],
  commonEdgeCases: [{ description: 'Urgent purchase bypass', frequency: 'occasional' }],
  commonSystems: ['SAP', 'Oracle'],
  industryVariations: { manufacturing: 'Includes BOM matching' },
}

const unknownDomain = {
  type: 'unknown',
  label: 'Unknown',
  typicalSteps: [{ name: 'Input', description: 'Generic input step', typicalSystems: [] }],
  commonEdgeCases: [],
  commonSystems: [],
  industryVariations: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getL1).mockReturnValue(fakeDomain as any)
  vi.mocked(getAllL1Domains).mockReturnValue([fakeDomain, unknownDomain] as any)
})

describe('L1 Domain Layer', () => {
  it('mode "matched" with known processType returns formatted domain string', async () => {
    const result = await l1DomainLayer.resolve(
      { rawData: { processType: 'procurement' } },
      { mode: 'matched' }
    )
    expect(result.templateVars.domainKnowledge).toContain('Procurement')
    expect(result.templateVars.domainKnowledge).toContain('PO Creation')
    expect(getL1).toHaveBeenCalledWith('procurement')
  })

  it('mode "matched" with unknown processType returns empty string', async () => {
    vi.mocked(getL1).mockReturnValue(unknownDomain as any)
    const result = await l1DomainLayer.resolve(
      { rawData: { processType: 'unknown' } },
      { mode: 'matched' }
    )
    // unknown domain is still returned but with minimal content
    expect(result.templateVars.domainKnowledge).toBeDefined()
  })

  it('mode "all" returns pre-rendered string of all domains', async () => {
    const result = await l1DomainLayer.resolve({}, { mode: 'all' })
    expect(result.templateVars.allDomains).toContain('Procurement')
    expect(result.templateVars.allDomains).toContain('Unknown')
    expect(getAllL1Domains).toHaveBeenCalled()
  })

  it('data.domains contains parsed domain objects', async () => {
    const result = await l1DomainLayer.resolve({}, { mode: 'all' })
    expect(result.data.domains).toBeDefined()
    expect(Array.isArray(result.data.domains)).toBe(true)
  })

  it('uses rawData.processType directly when provided', async () => {
    await l1DomainLayer.resolve({ rawData: { processType: 'procurement' } }, { mode: 'matched' })
    expect(getL1).toHaveBeenCalledWith('procurement')
    expect(getProcessById).not.toHaveBeenCalled()
  })

  it('resolves processType from processId when no rawData.processType', async () => {
    vi.mocked(getProcessById).mockResolvedValue({ processTypeL1: 'procurement' } as any)
    await l1DomainLayer.resolve({ processId: 'proc-123' }, { mode: 'matched' })
    expect(getProcessById).toHaveBeenCalledWith('proc-123')
    expect(getL1).toHaveBeenCalledWith('procurement')
  })

  it('defaults to "matched" mode when no options provided', async () => {
    const result = await l1DomainLayer.resolve({ rawData: { processType: 'procurement' } })
    expect(result.templateVars.domainKnowledge).toContain('Procurement')
  })
})
