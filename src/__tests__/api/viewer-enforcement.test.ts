// @vitest-environment node
/**
 * Regression tests: verify that all write routes reject viewer role with 403.
 * These test the backend enforcement via requireAdmin().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

// --- Shared mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

// Mock all DB queries to prevent real DB calls
vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
  listClients: vi.fn().mockResolvedValue([]),
  createClient: vi.fn(),
}))
vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  listSessionsByProcess: vi.fn().mockResolvedValue([]),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  softDeleteSession: vi.fn(),
}))
vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}))
vi.mock('@/lib/db/queries/contacts', () => ({
  listContactsByClient: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/db/queries/artifacts', () => ({
  createArtifact: vi.fn(),
  listArtifactsByProcess: vi.fn().mockResolvedValue([]),
  getArtifactById: vi.fn(),
  softDeleteArtifact: vi.fn(),
}))
vi.mock('@/lib/storage/blob', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  getFileStream: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { transaction: vi.fn() },
}))
vi.mock('@/lib/db/queries/events', () => ({
  listEventsBySession: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/db/queries/open-questions', () => ({
  listOpenQuestionsByProcess: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/validations/apply-synthesis', () => ({
  applySynthesisSchema: { safeParse: vi.fn() },
}))
vi.mock('@/lib/utils/merge-process-model', () => ({
  mergeSteps: vi.fn(),
  mergeEdgeCases: vi.fn(),
  mergeSystems: vi.fn(),
}))
vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(),
}))
vi.mock('@/lib/ai/gateway-factory', () => ({
  getAIGateway: vi.fn(() => ({ draftEmail: vi.fn() })),
}))
vi.mock('ai', () => ({
  streamText: vi.fn(),
  convertToModelMessages: vi.fn(),
  stepCountIs: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(),
}))

// --- Imports ---

import { POST as createClient } from '@/app/api/clients/route'
import { DELETE as deleteSession } from '@/app/api/sessions/[sessionId]/route'
import { POST as synthesize } from '@/app/api/sessions/[sessionId]/synthesize/route'
import { POST as aiResearch } from '@/app/api/ai/research/route'
import { POST as emailDraft } from '@/app/api/sessions/[sessionId]/email-draft/route'
import { POST as uploadArtifact } from '@/app/api/clients/[id]/processes/[processId]/artifacts/route'
import { DELETE as deleteArtifact } from '@/app/api/clients/[id]/processes/[processId]/artifacts/[artifactId]/route'
import { POST as applySync } from '@/app/api/sessions/[sessionId]/apply-synthesis/route'

// --- Helpers ---

function jsonReq(url: string, method = 'POST', body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// --- Tests ---

describe('Viewer role enforcement (403 on all write routes)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } })
  })

  it('POST /api/clients (create) → 403', async () => {
    const res = await createClient(
      jsonReq('/api/clients', 'POST', { name: 'Test', industry: 'IT' }) as any
    )
    expect(res.status).toBe(403)
  })

  it('DELETE /api/sessions/[sessionId] → 403', async () => {
    const res = await deleteSession(jsonReq('/api/sessions/s1', 'DELETE') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/sessions/[sessionId]/synthesize → 403', async () => {
    const res = await synthesize(jsonReq('/api/sessions/s1/synthesize') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/ai/research → 403', async () => {
    const res = await aiResearch(jsonReq('/api/ai/research', 'POST', { messages: [] }))
    expect(res.status).toBe(403)
  })

  it('POST /api/sessions/[sessionId]/email-draft → 403', async () => {
    const res = await emailDraft(jsonReq('/api/sessions/s1/email-draft') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /api/clients/[id]/processes/[processId]/artifacts (upload) → 403', async () => {
    const formData = new FormData()
    formData.append('file', new File(['x'], 'x.pdf', { type: 'application/pdf' }))
    const req = new Request('http://localhost/api/clients/c1/processes/p1/artifacts', {
      method: 'POST',
      body: formData,
    })
    const res = await uploadArtifact(req as any, {
      params: Promise.resolve({ id: 'c1', processId: 'p1' }),
    })
    expect(res.status).toBe(403)
  })

  it('DELETE /api/clients/[id]/processes/[processId]/artifacts/[artifactId] → 403', async () => {
    const res = await deleteArtifact(
      jsonReq('/api/clients/c1/processes/p1/artifacts/a1', 'DELETE') as any,
      { params: Promise.resolve({ id: 'c1', processId: 'p1', artifactId: 'a1' }) }
    )
    expect(res.status).toBe(403)
  })

  it('POST /api/sessions/[sessionId]/apply-synthesis → 403', async () => {
    const res = await applySync(jsonReq('/api/sessions/s1/apply-synthesis') as any, {
      params: Promise.resolve({ sessionId: 's1' }),
    })
    expect(res.status).toBe(403)
  })
})
