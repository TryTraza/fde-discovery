// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  listSessionsByClient: vi.fn(),
  createSession: vi.fn(),
  createSessionContacts: vi.fn(),
  linkSessionToProcess: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

vi.mock('@/lib/db/queries/contacts', () => ({
  getContactsByIds: vi.fn(),
}))

import { GET, POST } from '@/app/api/sessions/route'
import {
  listSessionsByClient,
  createSession,
  createSessionContacts,
  linkSessionToProcess,
} from '@/lib/db/queries/sessions'
import { getProcessById } from '@/lib/db/queries/processes'
import { getContactsByIds } from '@/lib/db/queries/contacts'

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

const PROCESS_UUID = 'd00b31bc-4160-49cb-83f1-05440fc7c807'
const CLIENT_UUID = 'a418704c-3e2c-451a-8eb3-0257bcb26016'
const CONTACT_UUID = 'e0e7c0e4-cf5a-4856-b42a-3c8bda1d3c8d'
const CONTACT_UUID_2 = '30ea39a2-c903-401c-917b-ebdac4784fbe'

const VALID_SESSION_BODY = {
  clientId: CLIENT_UUID,
  processIds: [PROCESS_UUID],
  type: 'discovery',
  title: 'Test Session',
  date: '2026-03-16',
}

describe('GET /api/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('GET', `http://localhost/api/sessions?clientId=${CLIENT_UUID}`)
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when clientId is missing', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = createRequest('GET', 'http://localhost/api/sessions')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when clientId is not a valid UUID', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = createRequest('GET', 'http://localhost/api/sessions?clientId=not-a-uuid')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when processId is not a valid UUID', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const req = createRequest(
      'GET',
      `http://localhost/api/sessions?clientId=${CLIENT_UUID}&processId=bad`
    )
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns sessions list for clientId', async () => {
    setupClerkMocks({ isAuthenticated: true })
    const mockSessions = [{ id: 's1', title: 'Session 1', type: 'discovery', status: 'planned' }]
    vi.mocked(listSessionsByClient).mockResolvedValue(mockSessions as any)

    const req = createRequest('GET', `http://localhost/api/sessions?clientId=${CLIENT_UUID}`)
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(mockSessions)
    expect(listSessionsByClient).toHaveBeenCalledWith(CLIENT_UUID)
  })

  it('returns sessions filtered by process when processId is set', async () => {
    setupClerkMocks({ isAuthenticated: true })
    vi.mocked(listSessionsByClient).mockResolvedValue([])

    const req = createRequest(
      'GET',
      `http://localhost/api/sessions?clientId=${CLIENT_UUID}&processId=${PROCESS_UUID}`
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(listSessionsByClient).toHaveBeenCalledWith(CLIENT_UUID, PROCESS_UUID)
  })
})

describe('POST /api/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for malformed JSON', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createBadJsonRequest('POST', 'http://localhost/api/sessions')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest('POST', 'http://localhost/api/sessions', { processId: PROCESS_UUID })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid session type', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      type: 'invalid_type',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date string', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      date: 'not-a-date',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when process does not exist', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(null as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('invalid')
  })

  it('returns 400 when contactIds reference invalid contacts', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ id: PROCESS_UUID, clientId: CLIENT_UUID } as any)
    vi.mocked(getContactsByIds).mockResolvedValue([{ id: CONTACT_UUID }] as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID_2],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('contactIds')
  })

  it('creates session with no contacts and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ id: PROCESS_UUID, clientId: CLIENT_UUID } as any)
    const mockSession = {
      id: 's1',
      clientId: CLIENT_UUID,
      processId: PROCESS_UUID,
      ...VALID_SESSION_BODY,
      status: 'planned',
      createdBy: 'user_test123',
    }
    vi.mocked(createSession).mockResolvedValue(mockSession as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBe('s1')
    expect(createSessionContacts).not.toHaveBeenCalled()
    expect(linkSessionToProcess).toHaveBeenCalledWith('s1', PROCESS_UUID)
  })

  it('creates session with contacts and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ id: PROCESS_UUID, clientId: CLIENT_UUID } as any)
    vi.mocked(getContactsByIds).mockResolvedValue([
      { id: CONTACT_UUID, clientId: CLIENT_UUID },
      { id: CONTACT_UUID_2, clientId: CLIENT_UUID },
    ] as any)
    const mockSession = { id: 's1', ...VALID_SESSION_BODY, status: 'planned' }
    vi.mocked(createSession).mockResolvedValue(mockSession as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID_2],
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(createSessionContacts).toHaveBeenCalledWith('s1', [CONTACT_UUID, CONTACT_UUID_2], {})
  })

  it('deduplicates contactIds', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ id: PROCESS_UUID, clientId: CLIENT_UUID } as any)
    vi.mocked(getContactsByIds).mockResolvedValue([{ id: CONTACT_UUID, clientId: CLIENT_UUID }] as any)
    vi.mocked(createSession).mockResolvedValue({ id: 's1' } as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID, CONTACT_UUID],
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(vi.mocked(getContactsByIds).mock.calls[0][0]).toHaveLength(1)
  })

  it('stores interviewAnswers as JSONB', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ id: PROCESS_UUID, clientId: CLIENT_UUID } as any)
    const answers = { questions: [{ question: 'Q1', answer: 'A1' }] }
    vi.mocked(createSession).mockResolvedValue({ id: 's1', interviewAnswers: answers } as any)

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      interviewAnswers: answers,
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(vi.mocked(createSession).mock.calls[0][0]).toMatchObject({
      interviewAnswers: answers,
    })
  })
})
