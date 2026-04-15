// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
  getProcessModel: vi.fn(),
  updateProcessModel: vi.fn(),
}))

// --- Imports (after mocks) ---

import { PATCH } from '@/app/api/clients/[id]/processes/[processId]/steps/route'
import { getProcessById, getProcessModel, updateProcessModel } from '@/lib/db/queries/processes'

// --- Helpers ---

function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/clients/c1/processes/p1/steps', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function withParams(params: { id: string; processId: string }) {
  return { params: Promise.resolve(params) }
}

// --- Fake data ---

const fakeProcess = { id: 'p1', clientId: 'c1', name: 'Purchasing', status: 'draft' }
const fakeModel = { id: 'model-1', processId: 'p1', steps: [], edgeCases: [], systems: [] }
const validSteps = [
  {
    id: 's1',
    name: 'Step 1',
    description: 'First',
    order: 1,
    confidence: 'confirmed',
    systems: [],
    edgeCases: [],
    notes: '',
  },
  {
    id: 's2',
    name: 'Step 2',
    description: 'Second',
    order: 2,
    confidence: 'inferred',
    systems: [{ name: 'SAP', confirmed: false, detailNotes: '' }],
    edgeCases: [],
    notes: 'Important',
  },
]

// --- Tests ---

describe('PATCH /api/clients/[id]/processes/[processId]/steps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 without admin role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(null as any)
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'bad' })
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when process belongs to different client (IDOR)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue({ ...fakeProcess, clientId: 'other' } as any)
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for empty steps array', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
    const res = await PATCH(createRequest({ steps: [] }), withParams({ id: 'c1', processId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid step data', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
    const res = await PATCH(
      createRequest({ steps: [{ bad: 'data' }] }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when process model not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
    vi.mocked(updateProcessModel).mockResolvedValue(null as any)
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(404)
  })

  it('returns 200 and updates steps on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
    vi.mocked(updateProcessModel).mockResolvedValue({ ...fakeModel, steps: validSteps } as any)
    const res = await PATCH(
      createRequest({ steps: validSteps }),
      withParams({ id: 'c1', processId: 'p1' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.steps).toHaveLength(2)
    expect(updateProcessModel).toHaveBeenCalledWith('p1', { steps: expect.any(Array) })
  })

  it('normalizes step order based on array position', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } })
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any)
    vi.mocked(updateProcessModel).mockResolvedValue({ ...fakeModel, steps: validSteps } as any)

    // Send steps with wrong order numbers — route should normalize
    const unorderedSteps = [
      { id: 's1', name: 'Step A', order: 99 },
      { id: 's2', name: 'Step B', order: 5 },
    ]
    await PATCH(createRequest({ steps: unorderedSteps }), withParams({ id: 'c1', processId: 'p1' }))

    const savedSteps = vi.mocked(updateProcessModel).mock.calls[0][1].steps
    expect(savedSteps[0].order).toBe(1)
    expect(savedSteps[1].order).toBe(2)
  })
})
