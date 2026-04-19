// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/db/queries/client-research', () => ({
  getResearchByClientId: vi.fn(),
  upsertClientResearch: vi.fn(),
}))

const mockResearchClient = vi.fn()
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: () => ({ researchClient: mockResearchClient }),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(),
}))

import { POST, GET } from '@/app/api/clients/[id]/research/route'
import { getClientById } from '@/lib/db/queries/clients'
import {
  getResearchByClientId,
  upsertClientResearch,
} from '@/lib/db/queries/client-research'
import { getAIConfig } from '@/lib/ai/get-ai-config'

function withParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function postReq(id: string) {
  return new Request(`http://localhost/api/clients/${id}/research`, { method: 'POST' })
}

function getReq(id: string) {
  return new Request(`http://localhost/api/clients/${id}/research`, { method: 'GET' })
}

const VALID_PAYLOAD = {
  companyOverview: 'Acme is a widget maker.',
  fitScore: 8,
  fitScoreRationale: 'Manual bottlenecks.',
  areasOfExpertise: ['widgets'],
  productsAndServices: [],
  keyStakeholders: [],
  techStack: [],
  researchSources: [],
  researchedAt: '2026-04-15T10:00:00.000Z',
  schemaVersion: 1,
}

describe('POST /api/clients/[id]/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAIConfig).mockResolvedValue({
      model: 'mock-model' as any,
      modelId: 'claude-sonnet-4-6',
      anthropic: { tools: { webSearch_20250305: () => ({}) } } as any,
    })
    mockResearchClient.mockResolvedValue(VALID_PAYLOAD)
    vi.mocked(upsertClientResearch).mockResolvedValue({
      ...VALID_PAYLOAD,
      clientId: 'c1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
  })

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST(postReq('c1'), withParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await POST(postReq('c1'), withParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue(null as any)
    const res = await POST(postReq('nope'), withParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 422 when getAIConfig rejects with NO_API_KEY', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
      website: null,
    } as any)
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'))

    const res = await POST(postReq('c1'), withParams('c1'))
    expect(res.status).toBe(422)
  })

  it('calls researchClient with client name/industry/website + model + anthropic', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
      website: 'https://acme.example.com',
    } as any)

    await POST(postReq('c1'), withParams('c1'))

    expect(mockResearchClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Acme',
        clientIndustry: 'Manufacturing',
        clientWebsite: 'https://acme.example.com',
        model: 'mock-model',
        anthropic: expect.any(Object),
      })
    )
  })

  it('upserts the research payload and returns the persisted row', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Acme',
      industry: 'Manufacturing',
      website: null,
    } as any)

    const res = await POST(postReq('c1'), withParams('c1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(upsertClientResearch).toHaveBeenCalledWith('c1', VALID_PAYLOAD)
    expect(data.clientId).toBe('c1')
    expect(data.fitScore).toBe(8)
  })
})

describe('GET /api/clients/[id]/research', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await GET(getReq('c1'), withParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with null when no research row exists', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getResearchByClientId).mockResolvedValue(null)

    const res = await GET(getReq('c1'), withParams('c1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toBeNull()
  })

  it('returns 200 with the research row when present', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const row = { ...VALID_PAYLOAD, clientId: 'c1' }
    vi.mocked(getResearchByClientId).mockResolvedValue(row as any)

    const res = await GET(getReq('c1'), withParams('c1'))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.clientId).toBe('c1')
  })
})
