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
  sessionIsLinkedToProcess: vi.fn(),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessWithModel: vi.fn(),
}))

const mockTransaction = vi.fn()
vi.mock('@/lib/db', () => ({
  db: { transaction: (...args: unknown[]) => mockTransaction(...args) },
}))

vi.mock('@/lib/utils/merge-process-model', () => ({
  mergeSteps: vi.fn((_c: any, s: any) =>
    s.map((x: any, i: number) => ({ id: `new-${i}`, ...x, order: i }))
  ),
  mergeEdgeCases: vi.fn((_c: any, e: any) =>
    e.map((x: any, i: number) => ({ id: `ec-${i}`, ...x }))
  ),
  mergeSystems: vi.fn((_c: any, s: any) =>
    s.map((x: any, i: number) => ({ id: `sys-${i}`, ...x }))
  ),
}))

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/apply-synthesis/route'
import { getSessionById, sessionIsLinkedToProcess } from '@/lib/db/queries/sessions'
import { getProcessWithModel } from '@/lib/db/queries/processes'

// --- Helpers ---

const SESSION_ID = 's1'
const TARGET_PROCESS_UUID = 'a1000000-0000-4000-8000-000000000001'

function createRequest(body: Record<string, unknown> = {}): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/apply-synthesis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetProcessId: TARGET_PROCESS_UUID, ...body }),
  })
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) }
}

const fakeSynthesis = {
  summary: 'Process summary',
  steps: [
    {
      stepId: null,
      name: 'Step 1',
      description: 'First',
      order: 0,
      confidence: 'confirmed',
      systems: [],
      changeType: 'new',
    },
  ],
  edgeCases: [],
  systems: [],
  openQuestions: [{ text: 'What about X?', priority: 'critical' }],
  confidence: 80,
}

const fakeSession = {
  id: SESSION_ID,
  processId: TARGET_PROCESS_UUID,
  type: 'discovery',
  status: 'synthesis_done',
  synthesisOutput: fakeSynthesis,
}

const fakeProcessModel = {
  id: 'pm-1',
  processId: TARGET_PROCESS_UUID,
  steps: [],
  edgeCases: [],
  systems: [],
}

const fakeProcess = {
  id: TARGET_PROCESS_UUID,
  name: 'Purchasing',
  description: 'Buy things',
  processModel: fakeProcessModel,
}

// --- Tests ---

describe('POST /api/sessions/[sessionId]/apply-synthesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessionIsLinkedToProcess).mockResolvedValue(true)
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi
            .fn()
            .mockReturnValue({ returning: vi.fn().mockResolvedValue([fakeProcessModel]) }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      }
      return fn(tx)
    })
  })

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

  it('returns 404 for nonexistent session', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(null as any)

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 when no synthesis data', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue({ ...fakeSession, synthesisOutput: null } as any)

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('synthesis')
  })

  it('returns 404 when process not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
    vi.mocked(getProcessWithModel).mockResolvedValue(null)

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(404)
  })

  it('returns 400 when session is not linked to target process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
    vi.mocked(sessionIsLinkedToProcess).mockResolvedValue(false)

    const res = await POST(createRequest(), withParams(SESSION_ID))
    expect(res.status).toBe(400)
  })

  it('applies all sections by default', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any)

    const res = await POST(createRequest({}), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('applies steps only when other sections disabled', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any)

    const { mergeSteps, mergeEdgeCases, mergeSystems } =
      await import('@/lib/utils/merge-process-model')

    const res = await POST(
      createRequest({
        applySteps: true,
        applyEdgeCases: false,
        applySystems: false,
        applyQuestions: false,
      }),
      withParams(SESSION_ID)
    )
    expect(res.status).toBe(200)
    expect(mergeSteps).toHaveBeenCalled()
    expect(mergeEdgeCases).not.toHaveBeenCalled()
    expect(mergeSystems).not.toHaveBeenCalled()
  })

  it('creates empty model when process has no model', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
    vi.mocked(getProcessWithModel).mockResolvedValue({ ...fakeProcess, processModel: null } as any)

    const res = await POST(createRequest({}), withParams(SESSION_ID))
    expect(res.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })
})
