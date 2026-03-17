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
      summary: 'This session should validate the 3-step purchasing flow.',
      questionsToAsk: [
        { question: 'How do you handle rush orders?', rationale: 'Identifies exception paths', followUp: 'What happens when approval is delayed?' },
        { question: 'Who approves purchases over $10k?', rationale: 'Maps authority chain', followUp: 'Is there a secondary approver?' },
      ],
      approaches: [
        { title: 'Walk through happy path first', description: 'Start with standard flow before probing exceptions' },
      ],
      areasToProbe: ['Approval bottlenecks', 'System handoffs', 'Manual workarounds'],
      watchFor: ['Mentions of shadow processes', 'Hesitation around compliance topics'],
    },
  }),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/[sessionId]/prep-brief/route';
import { getSessionById, listSessionContacts, getCompletedSessionsByProcess, updateSession } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { getAIConfig } from '@/lib/ai/get-ai-config';

// --- Helpers ---

const SESSION_ID = 's1';

function createRequest(): Request {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/prep-brief`, {
    method: 'POST',
  });
}

function withParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

const fakeSession = {
  id: SESSION_ID,
  processId: 'p1',
  type: 'discovery',
  status: 'planned',
  title: 'Kickoff',
  date: '2026-03-15',
  interviewAnswers: null,
  prepBrief: null,
  transcriptText: null,
  notes: null,
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

function setupDBMocks() {
  vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
  vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
  vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
  vi.mocked(listSessionContacts).mockResolvedValue([]);
  vi.mocked(getCompletedSessionsByProcess).mockResolvedValue([]);
  vi.mocked(updateSession).mockResolvedValue({} as any);
}

// --- Tests ---

describe('POST /api/sessions/[sessionId]/prep-brief', () => {
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

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks();
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'));

    const res = await POST(createRequest(), withParams(SESSION_ID));
    expect(res.status).toBe(422);
  });

  it('returns prep brief and updates session', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks();

    const res = await POST(createRequest(), withParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary).toBe('This session should validate the 3-step purchasing flow.');
    expect(data.questionsToAsk).toHaveLength(2);
    expect(data.approaches).toHaveLength(1);
    expect(data.areasToProbe).toHaveLength(3);
    expect(data.watchFor).toHaveLength(2);
    expect(updateSession).toHaveBeenCalledWith(SESSION_ID, {
      prepBrief: data,
    });
  });

  it('regenerate overwrites previous brief', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    setupDBMocks();
    vi.mocked(getSessionById).mockResolvedValue({
      ...fakeSession,
      prepBrief: { summary: 'old' },
    } as any);

    const res = await POST(createRequest(), withParams(SESSION_ID));

    expect(res.status).toBe(200);
    expect(updateSession).toHaveBeenCalled();
  });
});
