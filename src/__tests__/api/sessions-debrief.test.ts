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
  updateSession: vi.fn(),
  getPrimaryProcessIdForSession: vi.fn(),
}))

vi.mock('@/lib/db/queries/events', () => ({
  getEventsBySessionId: vi.fn(),
  getDebriefEvents: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const tx = {
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
  }
  // Set up chaining defaults
  tx.insert.mockReturnValue(tx)
  tx.values.mockReturnValue(tx)
  tx.returning.mockResolvedValue([{ id: 'oq-1' }])
  tx.update.mockReturnValue(tx)
  tx.set.mockReturnValue(tx)
  tx.where.mockReturnValue(tx)

  return {
    db: {
      transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      _mockTx: tx,
    },
  }
})

vi.mock('@/lib/db/schema', () => ({
  sessions: { id: 'sessions.id' },
  eventLogs: { id: 'eventLogs.id' },
  openQuestions: { id: 'openQuestions.id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _eq: [a, b] })),
}))

// --- Imports (after mocks) ---

import { POST, GET } from '@/app/api/sessions/[sessionId]/debrief/route'
import { getSessionById, getPrimaryProcessIdForSession } from '@/lib/db/queries/sessions'
import { getEventsBySessionId, getDebriefEvents } from '@/lib/db/queries/events'
import { db } from '@/lib/db'

// Access the mock tx instance
const mockTx = (db as any)._mockTx

// --- Helpers ---

const SESSION_ID = 's1'
const EVENT_Q1 = 'a0000000-0000-4000-a000-000000000001'
const EVENT_I1 = 'a0000000-0000-4000-a000-000000000002'

function createPostRequest(body: unknown): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/debrief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createGetRequest(): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/debrief`, { method: 'GET' })
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const fakeShadowingSession = {
  id: SESSION_ID,
  clientId: 'c1',
  processId: 'p1',
  type: 'shadowing',
  status: 'completed',
  debriefAnswers: null,
  transcriptText: null,
  notes: null,
}

const fakeEvents = [
  {
    id: EVENT_Q1,
    sessionId: SESSION_ID,
    type: 'QUESTION',
    label: 'Why is this step manual?',
    detail: null,
    timestamp: new Date('2026-03-20T10:00:00Z'),
  },
  {
    id: EVENT_I1,
    sessionId: SESSION_ID,
    type: 'IMPLICIT',
    label: null,
    detail: 'User hesitated here',
    timestamp: new Date('2026-03-20T10:05:00Z'),
  },
]

// --- Tests ---

describe('POST /api/sessions/[sessionId]/debrief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore tx chain after clearAllMocks
    mockTx.insert.mockReturnValue(mockTx)
    mockTx.values.mockReturnValue(mockTx)
    mockTx.returning.mockResolvedValue([{ id: 'oq-1' }])
    mockTx.update.mockReturnValue(mockTx)
    mockTx.set.mockReturnValue(mockTx)
    mockTx.where.mockReturnValue(mockTx)
    ;(db.transaction as any).mockImplementation(async (fn: any) => fn(mockTx))
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeShadowingSession as any)
    vi.mocked(getPrimaryProcessIdForSession).mockResolvedValue('p1')
    vi.mocked(getEventsBySessionId).mockResolvedValue(fakeEvents as any)
  })

  it('1. returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('2. returns 403 when user has viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(403)
  })

  it('3. returns 404 when session does not exist', async () => {
    vi.mocked(getSessionById).mockResolvedValue(null)
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('4. returns 400 when session type is not shadowing', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      type: 'discovery',
    } as any)
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/shadowing/i)
  })

  it('5. returns 400 when session status is planned', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      status: 'planned',
    } as any)
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('6. returns 400 when session status is in_progress', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      status: 'in_progress',
    } as any)
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('7. returns 400 when session already has debriefAnswers', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      debriefAnswers: { items: [] },
    } as any)
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('8. returns 400 when body fails validation', async () => {
    const res = await POST(
      createPostRequest({
        items: [{ eventLogId: 'not-a-uuid', type: 'invalid', resolution: 'bad' }],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details).toBeDefined()
  })

  it('9. returns 400 when resolution is asked_answered but type is implicit', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_I1,
            type: 'implicit',
            resolution: 'asked_answered',
            answer: 'Some answer',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
  })

  it('10. returns 400 when resolution is described but type is question', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'described',
            description: 'Some description',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
  })

  it('11. returns 400 when resolution is asked_answered but answer is empty', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'asked_answered',
            answer: '  ',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
  })

  it('12. returns 400 when resolution is open_question but priority is missing', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'open_question',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
  })

  it('13. returns 200 and saves debrief answers', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'asked_answered',
            answer: 'Because legacy systems require it',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('14. creates open questions for items with resolution open_question', async () => {
    mockTx.returning.mockResolvedValueOnce([{ id: 'oq-new-1' }])

    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'open_question',
            priority: 'critical',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].openQuestionId).toBeDefined()
  })

  it('15. returns 200 with empty items array (graceful no-op)', async () => {
    const res = await POST(createPostRequest({ items: [] }), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('16. returns 400 when eventLogId references non-existent event', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: 'a0000000-0000-4000-a000-000000000099',
            type: 'question',
            resolution: 'skipped',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/eventLogId/i)
  })

  it('17. runs open question creation atomically via transaction', async () => {
    mockTx.returning.mockRejectedValueOnce(new Error('DB insert failed'))

    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_Q1,
            type: 'question',
            resolution: 'open_question',
            priority: 'important',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    // Transaction failure should propagate as 500
    expect(res.status).toBe(500)
  })

  it('18. updates eventLog label for described IMPLICIT events within transaction', async () => {
    const res = await POST(
      createPostRequest({
        items: [
          {
            eventLogId: EVENT_I1,
            type: 'implicit',
            resolution: 'described',
            description: 'The user was checking a spreadsheet',
          },
        ],
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(200)
    // Verify tx.update was called (for event label update)
    expect(mockTx.update).toHaveBeenCalled()
  })
})

describe('GET /api/sessions/[sessionId]/debrief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeShadowingSession as any)
    vi.mocked(getDebriefEvents).mockResolvedValue(fakeEvents as any)
  })

  it('19. returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await GET(createGetRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('20. returns 404 when session does not exist', async () => {
    vi.mocked(getSessionById).mockResolvedValue(null)
    const res = await GET(createGetRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('21. returns only QUESTION and IMPLICIT events with null label', async () => {
    const res = await GET(createGetRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    // JSON serialization converts Date objects to strings
    expect(body).toEqual(fakeEvents.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() })))
  })

  it('22. returns empty array when no matching events', async () => {
    vi.mocked(getDebriefEvents).mockResolvedValue([])
    const res = await GET(createGetRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
