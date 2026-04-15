// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateObject = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({ model: 'mock-model', modelId: 'mock-id' }),
}))

const mockUpdateClient = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db/queries/clients', () => ({
  updateClient: (...args: unknown[]) => mockUpdateClient(...args),
}))

import { refreshCompanyProfile } from '@/lib/ai/prompts/refresh-company-profile'
import { companyProfileSchema } from '@/lib/ai/contracts'

const AI_OUTPUT = {
  description: 'Acme makes widgets.',
  industry: 'Manufacturing',
  areasOfExpertise: ['widgets'],
  productsAndServices: [{ name: 'Widget Pro', description: 'Pro-grade widget' }],
  sources: [],
}

describe('refreshCompanyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateObject.mockResolvedValue({ object: AI_OUTPUT })
  })

  it('composes a valid CompanyProfile from the AI output', async () => {
    const profile = await refreshCompanyProfile({
      clientId: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
      website: null,
    })
    const parsed = companyProfileSchema.safeParse(profile)
    expect(parsed.success).toBe(true)
    expect(profile.schemaVersion).toBe(1)
    expect(profile.description).toBe(AI_OUTPUT.description)
    expect(typeof profile.lastRefreshedAt).toBe('string')
    expect(() => new Date(profile.lastRefreshedAt).toISOString()).not.toThrow()
  })

  it('persists the profile via updateClient', async () => {
    await refreshCompanyProfile({
      clientId: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
    })
    expect(mockUpdateClient).toHaveBeenCalledTimes(1)
    const [clientId, patch] = mockUpdateClient.mock.calls[0]
    expect(clientId).toBe('c1')
    expect(patch.profile.schemaVersion).toBe(1)
    expect(patch.profile.description).toBe(AI_OUTPUT.description)
  })

  it('does not write aiSummary (new route only touches profile)', async () => {
    await refreshCompanyProfile({
      clientId: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
    })
    const [, patch] = mockUpdateClient.mock.calls[0]
    expect(patch).not.toHaveProperty('aiSummary')
  })

  it('throws if AI output is missing a required field', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { ...AI_OUTPUT, description: '' },
    })
    await expect(
      refreshCompanyProfile({ clientId: 'c1', name: 'Acme', industry: 'Manufacturing' })
    ).rejects.toThrow()
    expect(mockUpdateClient).not.toHaveBeenCalled()
  })
})
