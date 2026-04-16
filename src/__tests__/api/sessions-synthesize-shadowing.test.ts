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
  listSessionContacts: vi.fn().mockResolvedValue([]),
  getCompletedSessionsByProcess: vi.fn().mockResolvedValue([]),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessWithModel: vi.fn(),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/db/queries/events', () => ({
  getEventsBySessionId: vi.fn(),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}))

const mockSynthesizeShadowing = vi.fn()
const mockSynthesizeSession = vi.fn()
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: (slug: string) => {
    if (slug === 'shadowing-synthesis') return { synthesizeShadowing: mockSynthesizeShadowing }
    return { synthesizeSession: mockSynthesizeSession }
  },
}))

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/synthesize/route'
import { getSessionById, updateSession } from '@/lib/db/queries/sessions'

// --- Helpers ---

const SESSION_ID = 's1'

function createRequest(): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/synthesize`, { method: 'POST' })
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const fakeSynthesisResult = {
  summary: 'Shadowing revealed 4 steps with system interactions.',
  steps: [
    {
      stepId: null,
      name: 'Step 1',
      description: 'First',
      order: 0,
      confidence: 'confirmed',
      systems: ['Excel'],
      changeType: 'new',
    },
  ],
  edgeCases: [],
  systems: [
    {
      name: 'Excel',
      confirmed: true,
      role: 'Data entry',
      details: 'Main spreadsheet',
      detailNotes: 'Sheet: Quotes2024\nCol A = Supplier',
      changeType: 'new',
    },
  ],
  openQuestions: [],
  confidence: 85,
}

const fakeShadowingSession = {
  id: SESSION_ID,
  processId: 'p1',
  type: 'shadowing',
  title: 'Shadow: AP Process',
  date: '2026-03-20',
  status: 'completed',
  transcriptText: null,
  notes: 'User opened Excel first',
  interviewAnswers: null,
  synthesisOutput: null,
  debriefAnswers: {
    items: [{ eventLogId: 'e1', type: 'question', resolution: 'asked_answered', answer: 'Yes' }],
  },
}

const fakeProcess = {
  id: 'p1',
  clientId: 'c1',
  name: 'AP Process',
  description: 'Accounts payable',
  status: 'discovery',
  hypothesisText: 'Manual process',
  departmentTag: 'Finance',
  processTypeL1: 'procurement',
  processModel: null,
}

const fakeClient = {
  id: 'c1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: null,
  status: 'active',
  aiSummary: null,
  notes: null,
}

const fakeEvents = [
  {
    id: 'e1',
    sessionId: SESSION_ID,
    type: 'STEP',
    label: 'Open spreadsheet',
    detail: null,
    timestamp: new Date('2026-03-20T10:00:00Z'),
  },
  {
    id: 'e2',
    sessionId: SESSION_ID,
    type: 'SYSTEM',
    label: 'Excel',
    detail: 'Sheet: Quotes2024',
    timestamp: new Date('2026-03-20T10:01:00Z'),
  },
  {
    id: 'e3',
    sessionId: SESSION_ID,
    type: 'SYSTEM',
    label: 'Excel',
    detail: 'Col A = Supplier',
    timestamp: new Date('2026-03-20T10:02:00Z'),
  },
  {
    id: 'e4',
    sessionId: SESSION_ID,
    type: 'QUESTION',
    label: 'Why manual?',
    detail: null,
    timestamp: new Date('2026-03-20T10:03:00Z'),
  },
]

// --- Tests ---

describe('POST /api/sessions/[sessionId]/synthesize — shadowing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
      privateMetadata: { anthropicApiKey: 'sk-test' },
    })
    vi.mocked(getSessionById).mockResolvedValue(fakeShadowingSession as any)
    mockSynthesizeShadowing.mockResolvedValue(fakeSynthesisResult)
    mockSynthesizeSession.mockResolvedValue(fakeSynthesisResult)
  })

  it('1. returns 400 when shadowing session has no debriefAnswers', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      debriefAnswers: null,
    } as any)
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/debrief/i)
  })

  it('2. returns 400 when shadowing session has status !== completed', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      status: 'planned',
    } as any)
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('3. calls the shadowing-synthesis gateway method', async () => {
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    expect(mockSynthesizeShadowing).toHaveBeenCalledTimes(1)
  })

  it('4. forwards sessionId to the gateway', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    expect(mockSynthesizeShadowing).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID })
    )
  })

  it('5. forwards the resolved model to the gateway', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    const callArgs = mockSynthesizeShadowing.mock.calls[0][0]
    expect(callArgs.model).toBe('mock-model')
  })

  it('6. does not call the non-shadowing gateway method on a shadowing session', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    expect(mockSynthesizeSession).not.toHaveBeenCalled()
  })

  it('7. saves synthesis output via updateSession', async () => {
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.systems[0].detailNotes).toBe('Sheet: Quotes2024\nCol A = Supplier')
    expect(vi.mocked(updateSession)).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        synthesisOutput: fakeSynthesisResult,
      })
    )
  })

  it('8. non-shadowing session uses synthesizeSession (not synthesizeShadowing)', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      type: 'discovery',
      status: 'completed',
      transcriptText: 'We discussed the process',
      debriefAnswers: null,
    } as any)
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    expect(mockSynthesizeSession).toHaveBeenCalledTimes(1)
    expect(mockSynthesizeShadowing).not.toHaveBeenCalled()
  })

  it('9. returns 500 when the gateway throws', async () => {
    mockSynthesizeShadowing.mockRejectedValueOnce(new Error('AI failed'))
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(500)
  })

  it('10. does NOT update session when the gateway throws', async () => {
    mockSynthesizeShadowing.mockRejectedValueOnce(new Error('AI failed'))
    await POST(createRequest(), withParams(SESSION_ID))
    expect(vi.mocked(updateSession)).not.toHaveBeenCalled()
  })
})

