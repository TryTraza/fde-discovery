// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
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
    object: { question: 'What are the main pain points?', context: 'Understanding pain points helps focus the session.' },
  }),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/sessions/interview/route';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { generateObject } from 'ai';

// --- Helpers ---

const PROCESS_UUID = 'd00b31bc-4160-49cb-83f1-05440fc7c807';

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/sessions/interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const fakeProcess = {
  id: PROCESS_UUID,
  clientId: 'c1',
  name: 'Purchasing',
  description: 'Buy things',
  hypothesisText: 'This is a hypothesis',
  departmentTag: null,
  processModel: { steps: [], systems: [], edgeCases: [] },
};

const fakeClient = {
  id: 'c1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: null,
  aiSummary: null,
};

const VALID_BODY = {
  processId: PROCESS_UUID,
  sessionType: 'discovery',
  previousAnswers: [],
  questionIndex: 0,
};

// --- Tests ---

describe('POST /api/sessions/interview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing processId', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest({ sessionType: 'discovery', questionIndex: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid sessionType', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest({ ...VALID_BODY, sessionType: 'invalid_type' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessWithModel).mockResolvedValue(null);

    const req = createRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(getAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'));

    const req = createRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns { done: true } when questionIndex >= 3', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });

    const req = createRequest({ ...VALID_BODY, questionIndex: 3 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ done: true });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('returns question and context for valid request', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);

    const req = createRequest(VALID_BODY);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.done).toBe(false);
    expect(data.question).toBe('What are the main pain points?');
    expect(data.context).toBe('Understanding pain points helps focus the session.');
    expect(generateObject).toHaveBeenCalled();
  });
});
