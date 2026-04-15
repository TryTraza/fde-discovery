import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
}))

import { getClientById } from '@/lib/db/queries/clients'
import { getProcessById } from '@/lib/db/queries/processes'
import { getSessionById } from '@/lib/db/queries/sessions'
import { l2ClientLayer } from '@/lib/ai/layers/l2-client'

const fakeClient = {
  id: 'client-1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: 'https://acme.com',
  status: 'active_poc',
  aiSummary: 'A manufacturing company.',
  notes: 'Key client.',
  hqLocation: 'New York',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getClientById).mockResolvedValue(fakeClient as any)
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
})
