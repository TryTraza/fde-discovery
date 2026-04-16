// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

const mockDraftEmail = vi.fn()
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: () => ({ draftEmail: mockDraftEmail }),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: { modelId: 'claude-sonnet-4-6' },
    anthropic: {},
  }),
}))

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/db/queries/contacts', () => ({
  listContactsByClient: vi.fn(),
}))

// --- Imports ---

import { POST } from '@/app/api/sessions/[sessionId]/email-draft/route'
import { getSessionById } from '@/lib/db/queries/sessions'
import { getProcessById } from '@/lib/db/queries/processes'
import { getClientById } from '@/lib/db/queries/clients'
import { listContactsByClient } from '@/lib/db/queries/contacts'
import { getAIConfig } from '@/lib/ai/get-ai-config'

// --- Helpers ---

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/sessions/s1/email-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

const ADMIN_META = {
  publicMetadata: { role: 'admin' },
  privateMetadata: { anthropicApiKey: 'sk-ant-test-key' },
}

const MOCK_SESSION = {
  id: 's1',
  processId: 'p1',
  synthesisOutput: {
    summary: 'The procurement process involves 5 steps with manual data entry.',
    openQuestions: [
      { text: 'What triggers the PO creation?', priority: 'critical' },
      { text: 'How often do exceptions occur?', priority: 'important' },
    ],
    steps: [],
    edgeCases: [],
    systems: [],
    confidence: 75,
  },
}

const MOCK_PROCESS = { id: 'p1', name: 'PO Process', clientId: 'c1' }
const MOCK_CLIENT = { id: 'c1', name: 'Acme Corp', industry: 'Manufacturing' }
const MOCK_CONTACTS = [
  { name: 'Jane Doe', role: 'Procurement Manager' },
  { name: 'John Smith', role: 'IT Lead' },
]

// --- Tests ---

describe('POST /api/sessions/[sessionId]/email-draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDraftEmail.mockResolvedValue('Dear team, following up on our session...')
    vi.mocked(getAIConfig).mockResolvedValue({
      model: { modelId: 'claude-sonnet-4-6' },
      anthropic: {},
    } as any)
  })

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await POST(createRequest(), withParams('s1'))
    expect(res.status).toBe(403)
  })

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST(createRequest(), withParams('s1'))
    expect(res.status).toBe(401)
  })

  it('returns 422 if no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getAIConfig).mockRejectedValue(new Error('NO_API_KEY'))
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(getProcessById).mockResolvedValue(MOCK_PROCESS as any)
    vi.mocked(getClientById).mockResolvedValue(MOCK_CLIENT as any)
    vi.mocked(listContactsByClient).mockResolvedValue(MOCK_CONTACTS as any)

    const res = await POST(createRequest(), withParams('s1'))
    expect(res.status).toBe(422)
  })

  it('returns 404 if session not found', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getSessionById).mockResolvedValue(null as any)

    const res = await POST(createRequest(), withParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 400 if session has no synthesis output', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getSessionById).mockResolvedValue({
      ...MOCK_SESSION,
      synthesisOutput: null,
    } as any)

    const res = await POST(createRequest(), withParams('s1'))
    expect(res.status).toBe(400)
  })

  it('returns generated email text on success', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(getProcessById).mockResolvedValue(MOCK_PROCESS as any)
    vi.mocked(getClientById).mockResolvedValue(MOCK_CLIENT as any)
    vi.mocked(listContactsByClient).mockResolvedValue(MOCK_CONTACTS as any)

    const res = await POST(createRequest({ language: 'en' }), withParams('s1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.email).toBe('Dear team, following up on our session...')
  })

  it('forwards language to the gateway', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(getProcessById).mockResolvedValue(MOCK_PROCESS as any)
    vi.mocked(getClientById).mockResolvedValue(MOCK_CLIENT as any)
    vi.mocked(listContactsByClient).mockResolvedValue(MOCK_CONTACTS as any)

    await POST(createRequest({ language: 'es' }), withParams('s1'))

    const call = mockDraftEmail.mock.calls[0][0]
    expect(call.language).toBe('es')
  })

  it('includes session contacts in the gateway input', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META })
    vi.mocked(getSessionById).mockResolvedValue(MOCK_SESSION as any)
    vi.mocked(getProcessById).mockResolvedValue(MOCK_PROCESS as any)
    vi.mocked(getClientById).mockResolvedValue(MOCK_CLIENT as any)
    vi.mocked(listContactsByClient).mockResolvedValue(MOCK_CONTACTS as any)

    await POST(createRequest(), withParams('s1'))

    const call = mockDraftEmail.mock.calls[0][0]
    expect(call.contacts).toContainEqual({ name: 'Jane Doe', role: 'Procurement Manager' })
    expect(call.openQuestions).toContain('What triggers the PO creation?')
    expect(call.clientName).toBe('Acme Corp')
    expect(call.processName).toBe('PO Process')
  })
})
