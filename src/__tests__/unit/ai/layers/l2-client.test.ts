import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/db/queries/client-research', () => ({
  getResearchByClientId: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
}))

import { getClientById } from '@/lib/db/queries/clients'
import { getResearchByClientId } from '@/lib/db/queries/client-research'
import { getProcessById } from '@/lib/db/queries/processes'
import { getSessionById } from '@/lib/db/queries/sessions'
import { l2ClientLayer } from '@/lib/ai/layers/l2-client'

const fakeClient = {
  id: 'client-1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: 'https://acme.com',
  status: 'active_poc',
  notes: 'Key client.',
  hqLocation: 'New York',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getClientById).mockResolvedValue(fakeClient as any)
  vi.mocked(getResearchByClientId).mockResolvedValue(null)
  vi.mocked(getProcessById).mockResolvedValue({ clientId: 'client-1' } as any)
  vi.mocked(getSessionById).mockResolvedValue({ processId: 'proc-1' } as any)
})

describe('L2 Client Layer', () => {
  it('loads client from DB when clientId provided', async () => {
    const result = await l2ClientLayer.resolve({ clientId: 'client-1' })
    expect(getClientById).toHaveBeenCalledWith('client-1')
    expect(result.templateVars.clientName).toBe('Acme Corp')
  })

  it('uses rawData when clientName AND clientIndustry present (skips DB)', async () => {
    const result = await l2ClientLayer.resolve({
      rawData: { clientName: 'Raw Corp', clientIndustry: 'Tech' },
    })
    expect(getClientById).not.toHaveBeenCalled()
    expect(result.templateVars.clientName).toBe('Raw Corp')
    expect(result.templateVars.clientIndustry).toBe('Tech')
  })

  it('resolves clientId from processId', async () => {
    const result = await l2ClientLayer.resolve({ processId: 'proc-1' })
    expect(getProcessById).toHaveBeenCalledWith('proc-1')
    expect(getClientById).toHaveBeenCalledWith('client-1')
    expect(result.templateVars.clientName).toBe('Acme Corp')
  })

  it('resolves clientId from sessionId (double chain)', async () => {
    const result = await l2ClientLayer.resolve({ sessionId: 'sess-1' })
    expect(getSessionById).toHaveBeenCalledWith('sess-1')
    expect(getProcessById).toHaveBeenCalledWith('proc-1')
    expect(getClientById).toHaveBeenCalledWith('client-1')
  })

  it('fields "summary" returns only name, industry, website', async () => {
    const result = await l2ClientLayer.resolve({ clientId: 'client-1' }, { fields: 'summary' })
    expect(result.templateVars.clientName).toBe('Acme Corp')
    expect(result.templateVars.clientIndustry).toBe('Manufacturing')
    expect(result.templateVars.clientWebsite).toBe('https://acme.com')
    // Full fields should not be present in summary mode
    expect(result.templateVars.clientSection).toBeUndefined()
  })

  it('fields "full" (default) includes clientSection', async () => {
    const result = await l2ClientLayer.resolve({ clientId: 'client-1' }, { fields: 'full' })
    expect(result.templateVars.clientSection).toContain('Acme Corp')
    expect(result.templateVars.clientSection).toContain('Manufacturing')
  })

  it('returns empty LayerResult when no IDs and no rawData', async () => {
    const result = await l2ClientLayer.resolve({})
    expect(result.templateVars).toEqual({})
    expect(result.data).toEqual({})
  })

  describe('AI Research block', () => {
    it('renders a ### AI Research block when research row exists', async () => {
      vi.mocked(getResearchByClientId).mockResolvedValue({
        clientId: 'client-1',
        companyOverview: 'Acme builds widgets.',
        sizeFinancials: '500 employees, growth-stage.',
        customersMarkets: 'Enterprise buyers in EMEA.',
        painPoints: 'Manual procurement flows.',
        recentNews: 'Raised Series C in early 2026.',
        fitScore: 9,
        fitScoreRationale: 'Clear bottlenecks and appetite for change.',
        areasOfExpertise: ['widget engineering'],
        productsAndServices: [{ name: 'Widget Pro', description: 'Pro widgets' }],
        keyStakeholders: [{ name: 'Jane Doe', role: 'COO' }],
        techStack: ['SAP S/4HANA'],
        researchSources: [],
        researchedAt: new Date(),
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const result = await l2ClientLayer.resolve({ clientId: 'client-1' })
      expect(result.templateVars.clientSection).toContain('### AI Research')
      expect(result.templateVars.clientSection).toContain('Acme builds widgets.')
      expect(result.templateVars.clientSection).toMatch(/Fit:\*{0,2} 9\/10/)
      expect(result.templateVars.clientSection).toContain('Clear bottlenecks')
      expect(result.templateVars.clientSection).toContain('500 employees')
      expect(result.templateVars.clientSection).toContain('Widget Pro')
      expect(result.templateVars.clientSection).toContain('Jane Doe')
      expect(result.templateVars.clientSection).toContain('SAP S/4HANA')
    })

    it('omits the ### AI Research block when no research row exists', async () => {
      vi.mocked(getResearchByClientId).mockResolvedValue(null)
      const result = await l2ClientLayer.resolve({ clientId: 'client-1' })
      expect(result.templateVars.clientSection).not.toContain('### AI Research')
    })

    it('omits the Fit line when fitScore is null', async () => {
      vi.mocked(getResearchByClientId).mockResolvedValue({
        clientId: 'client-1',
        companyOverview: 'A company.',
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
        researchedAt: new Date(),
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      const result = await l2ClientLayer.resolve({ clientId: 'client-1' })
      expect(result.templateVars.clientSection).toContain('### AI Research')
      expect(result.templateVars.clientSection).not.toMatch(/Fit:\*{0,2} /)
    })

    it('passes the research row in data for callers that want structured access', async () => {
      const row = {
        clientId: 'client-1',
        companyOverview: 'Overview.',
        fitScore: 5,
        areasOfExpertise: [],
        productsAndServices: [],
        keyStakeholders: [],
        techStack: [],
        researchSources: [],
        researchedAt: new Date(),
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      vi.mocked(getResearchByClientId).mockResolvedValue(row as any)
      const result = await l2ClientLayer.resolve({ clientId: 'client-1' })
      expect((result.data as any).research).toEqual(row)
    })
  })
})
