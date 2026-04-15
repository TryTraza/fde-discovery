// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}))

const mockGenerateInterviewQuestion = vi.fn()
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: () => ({ generateInterviewQuestion: mockGenerateInterviewQuestion }),
}))

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/interview/route'
import { getAIConfig } from '@/lib/ai/get-ai-config'

// --- Helpers ---

const PROCESS_UUID = 'd00b31bc-4160-49cb-83f1-05440fc7c807'

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/sessions/interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const fakeProcess = {
  id: PROCESS_UUID,
  clientId: 'c1',
  name: 'Purchasing',
  description: 'Buy things',
  hypothesisText: 'This is a hypothesis',
  departmentTag: null,
  processModel: { steps: [], systems: [], edgeCases: [] },
}

const fakeClient = {
  id: 'c1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: null,
  aiSummary: null,
}

const VALID_BODY = {
  processId: PROCESS_UUID,
  sessionType: 'discovery',
  previousAnswers: [],
  questionIndex: 0,
}

// --- Tests ---

describe('POST /api/sessions/interview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateInterviewQuestion.mockResolvedValue({
      question: 'What are the main pain points?',
      context: 'Understanding pain points helps focus the session.',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const req = createRequest(VALID_BODY)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const req = createRequest(VALID_BODY)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing processId', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest({ sessionType: 'discovery', questionIndex: 0 })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid sessionType', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    const req = createRequest({ ...VALID_BODY, sessionType: 'invalid_type' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when the gateway fails (e.g. process not found)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    mockGenerateInterviewQuestion.mockRejectedValueOnce(new Error('Process not found'))

    const req = createRequest(VALID_BODY)
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'))

    const req = createRequest(VALID_BODY)
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('returns { done: true } when questionIndex >= 3', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })

    const req = createRequest({ ...VALID_BODY, questionIndex: 3 })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ done: true })
    expect(mockGenerateInterviewQuestion).not.toHaveBeenCalled()
  })

  it('returns question and context for valid request', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })

    const req = createRequest(VALID_BODY)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.done).toBe(false)
    expect(data.question).toBe('What are the main pain points?')
    expect(data.context).toBe('Understanding pain points helps focus the session.')
    expect(mockGenerateInterviewQuestion).toHaveBeenCalled()
  })
})
