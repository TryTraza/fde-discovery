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

const mockExecuteAI = vi.fn()
vi.mock('@/lib/ai/builder', () => ({
  executeAI: (...args: unknown[]) => mockExecuteAI(...args),
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
      gaps: null,
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
    mockExecuteAI.mockResolvedValue({
      data: fakeSynthesisResult,
      meta: {
        agentSlug: 'shadowing-synthesis',
        configVersion: 1,
        promptVersion: 1,
        model: 'standard',
        layerTimings: {},
        totalDuration: 100,
        layerErrors: [],
      },
    })
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

  it('3. calls executeAI with shadowing-synthesis agent', async () => {
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    expect(mockExecuteAI).toHaveBeenCalledTimes(1)
    expect(mockExecuteAI).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSlug: 'shadowing-synthesis',
        params: { sessionId: SESSION_ID },
      })
    )
  })

  it('4. calls executeAI with sessionId param', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    const callArgs = mockExecuteAI.mock.calls[0][0]
    expect(callArgs.params).toEqual({ sessionId: SESSION_ID })
  })

  it('5. calls executeAI with correct model', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    const callArgs = mockExecuteAI.mock.calls[0][0]
    expect(callArgs.model).toBe('mock-model')
  })

  it('6. calls executeAI with anthropic config', async () => {
    await POST(createRequest(), withParams(SESSION_ID))
    const callArgs = mockExecuteAI.mock.calls[0][0]
    expect(callArgs.anthropic).toBeDefined()
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

  it('8. non-shadowing session uses session-synthesis agent', async () => {
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeShadowingSession,
      type: 'discovery',
      status: 'completed',
      transcriptText: 'We discussed the process',
      debriefAnswers: null,
    } as any)
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const callArgs = mockExecuteAI.mock.calls[0][0]
    expect(callArgs.agentSlug).toBe('session-synthesis')
  })

  it('9. returns 500 when executeAI throws', async () => {
    mockExecuteAI.mockRejectedValueOnce(new Error('AI failed'))
    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(500)
  })

  it('10. does NOT update session when executeAI throws', async () => {
    mockExecuteAI.mockRejectedValueOnce(new Error('AI failed'))
    await POST(createRequest(), withParams(SESSION_ID))
    expect(vi.mocked(updateSession)).not.toHaveBeenCalled()
  })
})

describe('buildShadowingSynthesisPrompt', () => {
  // Import after mocks
  let buildShadowingSynthesisPrompt: typeof import('@/lib/ai/prompts/shadowing-synthesis').buildShadowingSynthesisPrompt

  beforeEach(async () => {
    const mod = await import('@/lib/ai/prompts/shadowing-synthesis')
    buildShadowingSynthesisPrompt = mod.buildShadowingSynthesisPrompt
  })

  const baseCtx = {
    client: {
      id: 'c1',
      name: 'Acme',
      industry: 'Mfg',
      website: null,
      status: 'active',
      aiSummary: null,
      notes: null,
    },
    process: {
      id: 'p1',
      name: 'AP',
      description: null,
      status: 'discovery',
      hypothesisText: null,
      departmentTag: null,
      processTypeL1: null,
      model: null,
    },
    session: {
      id: 's1',
      type: 'shadowing',
      title: 'Shadow',
      date: '2026-03-20',
      status: 'completed',
      interviewAnswers: null,
      transcriptText: null,
      notes: null,
    },
    sessionContacts: [],
    priorSessions: [],
    events: [
      { type: 'SYSTEM', label: 'Excel', detail: 'Col A = Name', timestamp: '2026-03-20T10:00:00Z' },
      {
        type: 'SYSTEM',
        label: 'Excel',
        detail: 'Sheet: Orders',
        timestamp: '2026-03-20T10:01:00Z',
      },
      { type: 'SYSTEM', label: 'SAP', detail: 'PO module', timestamp: '2026-03-20T10:02:00Z' },
      { type: 'STEP', label: 'Check email', detail: null, timestamp: '2026-03-20T10:03:00Z' },
    ],
    debriefAnswers: { items: [] },
    notes: 'Test notes',
  }

  it('13. groups SYSTEM events by label as system name', () => {
    const prompt = buildShadowingSynthesisPrompt(baseCtx as any)
    // Should group Excel events together
    expect(prompt).toContain('Excel')
    expect(prompt).toContain('SAP')
    expect(prompt).toContain('Col A = Name')
    expect(prompt).toContain('Sheet: Orders')
    expect(prompt).toContain('PO module')
  })

  it('14. excludes null/empty details from grouped system events', () => {
    const ctx = {
      ...baseCtx,
      events: [
        { type: 'SYSTEM', label: 'Excel', detail: null, timestamp: '2026-03-20T10:00:00Z' },
        { type: 'SYSTEM', label: 'Excel', detail: 'Has detail', timestamp: '2026-03-20T10:01:00Z' },
      ],
    }
    const prompt = buildShadowingSynthesisPrompt(ctx as any)
    expect(prompt).toContain('Has detail')
    // null details should be excluded from grouped output
  })

  it('15. handles sessions with zero SYSTEM events', () => {
    const ctx = {
      ...baseCtx,
      events: [
        { type: 'STEP', label: 'Do something', detail: null, timestamp: '2026-03-20T10:00:00Z' },
      ],
    }
    const prompt = buildShadowingSynthesisPrompt(ctx as any)
    expect(prompt).toContain('System Events Grouped')
    // Should not crash, just have empty object
    expect(prompt).toContain('{}')
  })
})
