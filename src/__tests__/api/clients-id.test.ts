// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  getClientWithRelations: vi.fn(),
  updateClient: vi.fn(),
  softDeleteClient: vi.fn(),
}))

// --- Imports (after mocks) ---

import { GET, PATCH, DELETE } from '@/app/api/clients/[id]/route'
import { getClientWithRelations, updateClient, softDeleteClient } from '@/lib/db/queries/clients'

// --- Helpers ---

function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function createBadJsonRequest(method: string, url: string): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json',
  })
}

function withParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// --- Tests ---

describe('GET /api/clients/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('GET', 'http://localhost/api/clients/c1')
    const res = await GET(req, withParams('c1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getClientWithRelations).mockResolvedValue(null)

    const req = createRequest('GET', 'http://localhost/api/clients/nonexistent')
    const res = await GET(req, withParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with client and relations when found', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const clientWithRelations = {
      id: 'c1',
      name: 'Acme Corp',
      contacts: [{ id: 'ct1', name: 'John' }],
      processes: [],
    }
    vi.mocked(getClientWithRelations).mockResolvedValue(clientWithRelations as any)

    const req = createRequest('GET', 'http://localhost/api/clients/c1')
    const res = await GET(req, withParams('c1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(clientWithRelations)
  })
})

describe('PATCH /api/clients/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('PATCH', 'http://localhost/api/clients/c1', {
      name: 'Updated',
    })
    const res = await PATCH(req, withParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid body (empty name)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest('PATCH', 'http://localhost/api/clients/c1', {
      name: '',
    })
    const res = await PATCH(req, withParams('c1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(updateClient).mockResolvedValue(null as any)

    const req = createRequest('PATCH', 'http://localhost/api/clients/nonexistent', {
      name: 'Updated',
    })
    const res = await PATCH(req, withParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated client on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const updated = { id: 'c1', name: 'Updated Corp', industry: 'Tech' }
    vi.mocked(updateClient).mockResolvedValue(updated as any)

    const req = createRequest('PATCH', 'http://localhost/api/clients/c1', {
      name: 'Updated Corp',
    })
    const res = await PATCH(req, withParams('c1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(updated)
  })

  it('returns 400 for malformed JSON body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createBadJsonRequest('PATCH', 'http://localhost/api/clients/c1')
    const res = await PATCH(req, withParams('c1'))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid JSON' })
  })
})

describe('DELETE /api/clients/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('DELETE', 'http://localhost/api/clients/c1')
    const res = await DELETE(req, withParams('c1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(softDeleteClient).mockResolvedValue(null as any)

    const req = createRequest('DELETE', 'http://localhost/api/clients/nonexistent')
    const res = await DELETE(req, withParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with message on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(softDeleteClient).mockResolvedValue({ id: 'c1' } as any)

    const req = createRequest('DELETE', 'http://localhost/api/clients/c1')
    const res = await DELETE(req, withParams('c1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ message: 'Client deleted' })
  })
})
