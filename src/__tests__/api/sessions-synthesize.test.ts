// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  listSessionContacts: vi.fn(),
  getCompletedSessionsByProcess: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessWithModel: vi.fn(),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      summary: 'Process has 3 main steps with one edge case.',
      steps: [{ stepId: null, name: 'Step 1', description: 'First step', order: 0, confidence: 'confirmed', systems: [], changeType: 'new' }],
      edgeCases: [],
      systems: [],
      openQuestions: [{ text: 'What happens on failure?', priority: 'critical' }],
      confidence: 75,
    },
  }),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/synthesize/route';
import { getSessionById, listSessionContacts, getCompletedSessionsByProcess, updateSession } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { getAIConfig } from '@/lib/ai/get-ai-config';

// --- Helpers ---

const SESSION_ID = 's1';

function createRequest(): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/synthesize`, { method: 'POST' });
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

const fakeSession = {
  id: SESSION_ID,
  processId: 'p1',
  type: 'discovery',
  title: 'Kickoff',
  date: '2026-03-15',
  status: 'completed',
  transcriptText: 'We discussed the purchasing process...',
  notes: 'Key insight: manual approval step',
  interviewAnswers: null,
  synthesisOutput: null,
};

const fakeProcess = {
  id: 'p1',
  clientId: 'c1',
  name: 'Purchasing',
  description: 'Buy things',
  status: 'mapping',
  hypothesisText: null,
  departmentTag: null,
  processTypeL1: null,
  processModel: { steps: [], systems: [], edgeCases: [] },
};

const fakeClient = {
  id: 'c1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: null,
  status: 'active_poc',
  aiSummary: null,
  notes: null,
};

function setupDBMocks(sessionOverrides?: Partial<typeof fakeSession>) {
  vi.mocked(getSessionById).mockResolvedValue({ ...fakeSession, ...sessionOverrides } as any);
  vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
  vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
  vi.mocked(listSessionContacts).mockResolvedValue([]);
  vi.mocked(getCompletedSessionsByProcess).mockResolvedValue([]);
  vi.mocked(updateSession).mockResolvedValue({} as any);
}

// --- Tests ---

describe('POST /api/sessions/[sessionId]/synthesize', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent session', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getSessionById).mockResolvedValue(null as any);

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(404);
  });

  it('returns 400 when status is planned', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks({ status: 'planned' });

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('completed');
  });

  it('returns 400 when status is in_progress', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks({ status: 'in_progress' });

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(400);
  });

  it('returns 400 when status is synthesis_done', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks({ status: 'synthesis_done' });

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(400);
  });

  it('returns 400 when both transcript and notes are null', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks({ transcriptText: null as any, notes: null as any });

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('transcript or notes');
  });

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks();
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'));

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(422);
  });

  it('returns synthesis and updates session to synthesis_done', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks();

    const res = await POST(createRequest(), withParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary).toBe('Process has 3 main steps with one edge case.');
    expect(data.steps).toHaveLength(1);
    expect(data.openQuestions).toHaveLength(1);
    expect(data.confidence).toBe(75);

    expect(updateSession).toHaveBeenCalledWith(SESSION_ID, {
      synthesisOutput: data,
      status: 'synthesis_done',
    });
  });
});
