// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
  getProcessWithModel: vi.fn(),
  updateProcess: vi.fn(),
  softDeleteProcess: vi.fn(),
}))

// --- Imports (after mocks) ---

import { GET, PATCH, DELETE } from '@/app/api/clients/[id]/processes/[processId]/route'
import {
  getProcessById,
  getProcessWithModel,
  updateProcess,
  softDeleteProcess,
} from '@/lib/db/queries/processes'

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

function withParams(params: { id: string; processId: string }) {
  return { params: Promise.resolve(params) }
}

// --- Fake data ---

const fakeProcess = {
  id: 'proc-1',
  clientId: 'client-1',
  name: 'Purchasing',
  status: 'draft',
  description: null,
  departmentTag: null,
  processTypeL1: null,
  hypothesisText: null,
}

const fakeProcessWithModel = {
  ...fakeProcess,
  processModel: { id: 'model-1', steps: [], edgeCases: [], systems: [] },
  openQuestions: [],
}

// --- Tests ---

describe('GET /api/clients/[id]/processes/[processId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes/proc-1')
    const res = await GET(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getProcessWithModel).mockResolvedValue(null)
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes/bad-id')
    const res = await GET(req, withParams({ id: 'client-1', processId: 'bad-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when process belongs to different client (IDOR)', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getProcessWithModel).mockResolvedValue({
      ...fakeProcessWithModel,
      clientId: 'other-client',
    } as any)
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes/proc-1')
    const res = await GET(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(404)
  })

  it('returns 200 with process and model on success', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcessWithModel as any)
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes/proc-1')
    const res = await GET(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Purchasing')
    expect(body).toHaveProperty('processModel')
  })
})

describe('PATCH /api/clients/[id]/processes/[processId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('PATCH', 'http://localhost/api/clients/client-1/processes/proc-1', {
      name: 'Updated',
    })
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for empty body (refine rejects)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest('PATCH', 'http://localhost/api/clients/client-1/processes/proc-1', {})
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createBadJsonRequest(
      'PATCH',
      'http://localhost/api/clients/client-1/processes/proc-1'
    )
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(null as any)
    const req = createRequest('PATCH', 'http://localhost/api/clients/client-1/processes/bad-id', {
      name: 'Updated',
    })
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'bad-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated process on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ ...fakeProcess, clientId: 'client-1' } as any)
    vi.mocked(updateProcess).mockResolvedValue({ ...fakeProcess, name: 'Updated Name' } as any)
    const req = createRequest('PATCH', 'http://localhost/api/clients/client-1/processes/proc-1', {
      name: 'Updated Name',
    })
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Name')
  })

  it('returns 422 for invalid status transition (draft → locked)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({
      ...fakeProcess,
      status: 'draft',
      clientId: 'client-1',
    } as any)
    const req = createRequest('PATCH', 'http://localhost/api/clients/client-1/processes/proc-1', {
      status: 'locked',
    })
    const res = await PATCH(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/clients/[id]/processes/[processId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('DELETE', 'http://localhost/api/clients/client-1/processes/proc-1')
    const res = await DELETE(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(null as any)
    const req = createRequest('DELETE', 'http://localhost/api/clients/client-1/processes/bad-id')
    const res = await DELETE(req, withParams({ id: 'client-1', processId: 'bad-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 200 with id and message on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ ...fakeProcess, clientId: 'client-1' } as any)
    vi.mocked(softDeleteProcess).mockResolvedValue({ id: 'proc-1' } as any)
    const req = createRequest('DELETE', 'http://localhost/api/clients/client-1/processes/proc-1')
    const res = await DELETE(req, withParams({ id: 'client-1', processId: 'proc-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: 'proc-1', message: 'Process deleted' })
  })
})
