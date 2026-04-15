// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/events', () => ({
  createEventsBatch: vi.fn(),
}))

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/events/batch/route'
import { createEventsBatch } from '@/lib/db/queries/events'

// --- Helpers ---

function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const SESSION_ID = 'd00b31bc-4160-49cb-83f1-05440fc7c807'

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  timestamp: '2026-03-21T10:00:00.000Z',
  type: 'STEP',
  label: 'Test step',
  ...overrides,
})

// --- POST /api/sessions/[sessionId]/events/batch ---

describe('POST /api/sessions/[sessionId]/events/batch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates multiple events atomically and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const serverEvents = [
      { id: 'srv-1', type: 'STEP', label: 'Step 1' },
      { id: 'srv-2', type: 'EDGE', label: 'Edge 1' },
      { id: 'srv-3', type: 'SYSTEM', label: 'SAP' },
    ]
    vi.mocked(createEventsBatch).mockResolvedValue(serverEvents as any)

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [
        makeEvent({ label: 'Step 1' }),
        makeEvent({ type: 'EDGE', label: 'Edge 1' }),
        makeEvent({ type: 'SYSTEM', label: 'SAP' }),
      ],
    })
    const res = await POST(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.created).toBe(3)
    expect(data.events).toHaveLength(3)
  })

  it('overrides sessionId from URL param for all events (security)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const capturedArgs = vi.fn()
    vi.mocked(createEventsBatch).mockImplementation(async (events: any) => {
      capturedArgs(events)
      return events.map((e: any, i: number) => ({ ...e, id: `srv-${i}` }))
    })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [
        { ...makeEvent(), sessionId: 'attacker-session-id' },
        { ...makeEvent(), sessionId: 'another-fake-id' },
      ],
    })
    const res = await POST(req, withParams(SESSION_ID))

    expect(res.status).toBe(201)
    const passedEvents = capturedArgs.mock.calls[0][0]
    for (const event of passedEvents) {
      expect(event.sessionId).toBe(SESSION_ID)
    }
  })

  it('rejects empty events array with 400', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [],
    })
    const res = await POST(req, withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('rejects batch exceeding 50 events with 400', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: Array(51).fill(makeEvent()),
    })
    const res = await POST(req, withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('rejects if any event has invalid type with 400', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [makeEvent(), makeEvent({ type: 'BOGUS' })],
    })
    const res = await POST(req, withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated request with 401', async () => {
    setupClerkMocks({ isAuthenticated: false })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [makeEvent()],
    })
    const res = await POST(req, withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('rejects non-admin user with 403', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [makeEvent()],
    })
    const res = await POST(req, withParams(SESSION_ID))
    expect(res.status).toBe(403)
  })

  it('returns created count and events array in insertion order', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(createEventsBatch).mockResolvedValue([
      { id: 'srv-a', type: 'STEP', label: 'A' },
      { id: 'srv-b', type: 'EDGE', label: 'B' },
    ] as any)

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events/batch`, {
      events: [makeEvent({ label: 'A' }), makeEvent({ type: 'EDGE', label: 'B' })],
    })
    const res = await POST(req, withParams(SESSION_ID))
    const data = await res.json()

    expect(data.created).toBe(2)
    expect(data.events[0].label).toBe('A')
    expect(data.events[1].label).toBe('B')
  })
})
