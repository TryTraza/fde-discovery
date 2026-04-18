// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  getSessionWithContacts: vi.fn(),
  getLinkedProcesses: vi.fn(),
  updateSession: vi.fn(),
  softDeleteSession: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

// --- Imports (after mocks) ---

import { GET, PATCH, DELETE } from '@/app/api/sessions/[sessionId]/route'
import {
  getSessionById,
  getSessionWithContacts,
  getLinkedProcesses,
  updateSession,
  softDeleteSession,
} from '@/lib/db/queries/sessions'

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

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const SESSION_ID = 's-00000000-0000-0000-0000-000000000001'

const MOCK_SESSION = {
  id: SESSION_ID,
  processId: 'p1',
  type: 'discovery',
  title: 'Test Session',
  date: '2026-03-16',
  status: 'planned',
  transcriptText: null,
  notes: null,
  contacts: [],
}

// --- GET /api/sessions/[sessionId] ---

describe('GET /api/sessions/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getLinkedProcesses).mockResolvedValue([])
  })

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await GET(req, withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 404 when session not found', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getSessionWithContacts).mockResolvedValue(null)

    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await GET(req, withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns session with contacts', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(getSessionWithContacts).mockResolvedValue(MOCK_SESSION as any)

    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await GET(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ ...MOCK_SESSION, linkedProcesses: [] })
  })
})

// --- PATCH /api/sessions/[sessionId] ---

describe('PATCH /api/sessions/[sessionId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      title: 'New',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      title: 'New',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createBadJsonRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await PATCH(req, withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('returns 404 when session not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(null as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      title: 'New',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('updates transcript', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue({
      ...MOCK_SESSION,
      transcriptText: 'New transcript',
    } as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      transcriptText: 'New transcript',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.transcriptText).toBe('New transcript')
  })

  it('updates notes', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue({ ...MOCK_SESSION, notes: 'My notes' } as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      notes: 'My notes',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.notes).toBe('My notes')
  })

  it('updates status', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue({ ...MOCK_SESSION, status: 'in_progress' } as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      status: 'in_progress',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe('in_progress')
  })

  it('updates date', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue({ ...MOCK_SESSION, date: '2026-04-01' } as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      date: '2026-04-01',
    })
    const res = await PATCH(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.date).toBe('2026-04-01')
  })

  it('accepts questionsAsked boolean array', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue({
      ...MOCK_SESSION,
      questionsAsked: [true, false, true],
    } as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {
      questionsAsked: [true, false, true],
    })
    const res = await PATCH(req, withParams(SESSION_ID))

    expect(res.status).toBe(200)
    expect(vi.mocked(updateSession)).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ questionsAsked: [true, false, true] })
    )
  })

  it('returns 200 unchanged with empty body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(updateSession).mockResolvedValue(MOCK_SESSION as any)

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}`, {})
    const res = await PATCH(req, withParams(SESSION_ID))

    expect(res.status).toBe(200)
  })
})

// --- DELETE /api/sessions/[sessionId] ---

describe('DELETE /api/sessions/[sessionId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('DELETE', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await DELETE(req, withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('DELETE', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await DELETE(req, withParams(SESSION_ID))
    expect(res.status).toBe(403)
  })

  it('returns 404 when session not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(softDeleteSession).mockResolvedValue(null as any)

    const req = createRequest('DELETE', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await DELETE(req, withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('soft-deletes and returns success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(softDeleteSession).mockResolvedValue({ id: SESSION_ID } as any)

    const req = createRequest('DELETE', `http://localhost/api/sessions/${SESSION_ID}`)
    const res = await DELETE(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
  })
})
