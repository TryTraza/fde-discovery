// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
  updateClient: vi.fn(),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}))

const mockRefreshCompanyProfile = vi.fn()
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: () => ({ refreshCompanyProfile: mockRefreshCompanyProfile }),
}))

import { POST } from '@/app/api/clients/[id]/refresh-profile/route'
import { getClientById, updateClient } from '@/lib/db/queries/clients'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { validCompanyProfile } from '@/lib/ai/contracts/__fixtures__'

function withParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function createRequest(id: string) {
  return new Request(`http://localhost/api/clients/${id}/refresh-profile`, { method: 'POST' })
}

describe('POST /api/clients/[id]/refresh-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshCompanyProfile.mockResolvedValue(validCompanyProfile)
  })

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST(createRequest('c1'), withParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await POST(createRequest('c1'), withParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue(null as any)

    const res = await POST(createRequest('nonexistent'), withParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      industry: 'Tech',
      website: 'https://acme.com',
    } as any)
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'))

    const res = await POST(createRequest('c1'), withParams('c1'))
    expect(res.status).toBe(422)
  })

  it('returns the generated profile and persists it', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      industry: 'Tech',
      website: 'https://acme.com',
    } as any)

    const res = await POST(createRequest('c1'), withParams('c1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(validCompanyProfile)
    expect(mockRefreshCompanyProfile).toHaveBeenCalledWith({
      clientName: 'Acme',
      clientIndustry: 'Tech',
      clientWebsite: 'https://acme.com',
      model: 'mock-model',
    })
    expect(updateClient).toHaveBeenCalledWith('c1', { profile: validCompanyProfile })
  })
})
