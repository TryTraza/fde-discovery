// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  updateSession: vi.fn(),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}))

const mockPrepBrief = {
  summary: 'This session should validate the 3-step purchasing flow.',
  questionsToAsk: [
    {
      question: 'How do you handle rush orders?',
      rationale: 'Identifies exception paths',
      followUp: 'What happens when approval is delayed?',
    },
    {
      question: 'Who approves purchases over $10k?',
      rationale: 'Maps authority chain',
      followUp: 'Is there a secondary approver?',
    },
  ],
  approaches: [
    {
      title: 'Walk through happy path first',
      description: 'Start with standard flow before probing exceptions',
    },
  ],
  areasToProbe: ['Approval bottlenecks', 'System handoffs', 'Manual workarounds'],
  watchFor: ['Mentions of shadow processes', 'Hesitation around compliance topics'],
}

const mockGeneratePrepBrief = vi.fn().mockResolvedValue(mockPrepBrief)

vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: () => ({ generatePrepBrief: mockGeneratePrepBrief }),
}))

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/prep-brief/route'
import { updateSession } from '@/lib/db/queries/sessions'
import { getAIConfig } from '@/lib/ai/get-ai-config'

// --- Helpers ---

const SESSION_ID = 's1'

function createRequest(): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/prep-brief`, {
    method: 'POST',
  })
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

// No fake DB data needed — route delegates to executeAI which is mocked

function setupDBMocks() {
  vi.mocked(updateSession).mockResolvedValue({} as any)
}

// --- Tests ---

describe('POST /api/sessions/[sessionId]/prep-brief', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the gateway throws Session not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    setupDBMocks()
    mockGeneratePrepBrief.mockRejectedValueOnce(new Error('Session not found'))

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    setupDBMocks()
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'))

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(422)
  })

  it('returns prep brief and updates session', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    setupDBMocks()

    const res = await POST(createRequest(), withParams(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary).toBe('This session should validate the 3-step purchasing flow.')
    expect(data.questionsToAsk).toHaveLength(2)
    expect(data.approaches).toHaveLength(1)
    expect(data.areasToProbe).toHaveLength(3)
    expect(data.watchFor).toHaveLength(2)
    expect(updateSession).toHaveBeenCalledWith(SESSION_ID, {
      prepBrief: mockPrepBrief,
    })
  })

  it('calls the gateway with sessionId and updates session', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    setupDBMocks()

    const res = await POST(createRequest(), withParams(SESSION_ID))

    expect(res.status).toBe(200)
    expect(updateSession).toHaveBeenCalled()
    expect(mockGeneratePrepBrief).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID })
    )
  })
})
