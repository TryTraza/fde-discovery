// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  listProcessesByClient: vi.fn(),
  createProcess: vi.fn(),
  createProcessModel: vi.fn(),
  softDeleteProcess: vi.fn(),
  updateProcess: vi.fn(),
  updateProcessModel: vi.fn(),
}));

const mockExecuteAI = vi.fn().mockResolvedValue({
  data: { hypothesisText: 'Test hypothesis', matchedProcessType: 'procurement', initialSteps: [] },
  meta: { agentSlug: 'process-hypothesis', configVersion: 1, promptVersion: 1, model: 'standard', layerTimings: {}, totalDuration: 100, layerErrors: [] },
});
vi.mock('@/lib/ai/builder', () => ({
  executeAI: (...args: unknown[]) => mockExecuteAI(...args),
}));

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-sonnet-4-6',
    anthropic: {},
  }),
}));

// --- Imports (after mocks) ---

import { GET, POST } from '@/app/api/clients/[id]/processes/route';
import { getClientById } from '@/lib/db/queries/clients';
import {
  listProcessesByClient,
  createProcess,
  createProcessModel,
} from '@/lib/db/queries/processes';

// --- Helpers ---

function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createBadJsonRequest(method: string, url: string): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json',
  });
}

function withParams(params: { id: string }) {
  return { params: Promise.resolve(params) };
}

// --- Fake data ---

const fakeClient = { id: 'client-1', name: 'Acme Corp', industry: 'Manufacturing', website: 'https://acme.com' };
const fakeProcess = { id: 'proc-1', clientId: 'client-1', name: 'Purchasing', status: 'draft' };

// --- Tests ---

describe('GET /api/clients/[id]/processes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes');
    const res = await GET(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 for nonexistent client', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(getClientById).mockResolvedValue(null as any);
    const req = createRequest('GET', 'http://localhost/api/clients/bad-id/processes');
    const res = await GET(req, withParams({ id: 'bad-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 200 with processes array for valid client', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(listProcessesByClient).mockResolvedValue([fakeProcess] as any);
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes');
    const res = await GET(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Purchasing');
  });
});

describe('POST /api/clients/[id]/processes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 without admin auth', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', { name: 'Test' });
    const res = await POST(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent client', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(null as any);
    const req = createRequest('POST', 'http://localhost/api/clients/bad-id/processes', { name: 'Test' });
    const res = await POST(req, withParams({ id: 'bad-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing name', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', {});
    const res = await POST(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    const req = createBadJsonRequest('POST', 'http://localhost/api/clients/client-1/processes');
    const res = await POST(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 and triggers hypothesis for valid input', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(createProcess).mockResolvedValue(fakeProcess as any);
    vi.mocked(createProcessModel).mockResolvedValue({} as any);

    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', {
      name: 'Purchasing',
      description: 'Buy things',
    });
    const res = await POST(req, withParams({ id: 'client-1' }));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.name).toBe('Purchasing');
    expect(createProcessModel).toHaveBeenCalledWith('proc-1');
    expect(mockExecuteAI).toHaveBeenCalledWith(
      expect.objectContaining({ agentSlug: 'process-hypothesis' })
    );
  });
});
