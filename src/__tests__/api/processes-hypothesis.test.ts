// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
  updateProcess: vi.fn(),
  updateProcessModel: vi.fn(),
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

const mockExecuteAI = vi.fn();
vi.mock('@/lib/ai/builder', () => ({
  executeAI: (...args: unknown[]) => mockExecuteAI(...args),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/clients/[id]/processes/[processId]/hypothesis/route';
import { getProcessById } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';

// --- Helpers ---

function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withParams(params: { id: string; processId: string }) {
  return { params: Promise.resolve(params) };
}

// --- Fake data ---

const fakeProcess = { id: 'proc-1', clientId: 'client-1', name: 'Purchasing', description: 'Buy things', status: 'draft' };
const fakeClient = { id: 'client-1', name: 'Acme Corp', industry: 'Manufacturing', website: 'https://acme.com' };

// --- Tests ---

describe('POST /api/clients/[id]/processes/[processId]/hypothesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteAI.mockResolvedValue({
      data: { hypothesisText: 'Test hypothesis', matchedProcessType: 'procurement', initialSteps: [] },
      meta: { agentSlug: 'process-hypothesis', configVersion: 1, promptVersion: 1, model: 'standard', layerTimings: {}, totalDuration: 100, layerErrors: [] },
    });
  });

  it('returns 403 without admin auth', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/proc-1/hypothesis');
    const res = await POST(req, withParams({ id: 'client-1', processId: 'proc-1' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent process', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue(null as any);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/bad-id/hypothesis');
    const res = await POST(req, withParams({ id: 'client-1', processId: 'bad-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when process belongs to different client (IDOR)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ ...fakeProcess, clientId: 'other-client' } as any);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/proc-1/hypothesis');
    const res = await POST(req, withParams({ id: 'client-1', processId: 'proc-1' }));
    expect(res.status).toBe(404);
  });

  it('returns 422 when no API key configured', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' }, privateMetadata: {} });
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    // getAIConfig throws 'NO_API_KEY' when no key → handleAPIError maps to 422
    const { getAIConfig: mockGetAIConfig } = await import('@/lib/ai/get-ai-config');
    vi.mocked(mockGetAIConfig).mockRejectedValueOnce(new Error('NO_API_KEY'));
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/proc-1/hypothesis');
    const res = await POST(req, withParams({ id: 'client-1', processId: 'proc-1' }));
    expect(res.status).toBe(422);
  });

  it('returns 200 and triggers hypothesis when API key exists', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
    });
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/proc-1/hypothesis');
    const res = await POST(req, withParams({ id: 'client-1', processId: 'proc-1' }));
    expect(res.status).toBe(200);
    expect(mockExecuteAI).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSlug: 'process-hypothesis',
        model: 'mock-model',
      }),
    );
  });

  it('passes correct overrides to executeAI', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
    });
    vi.mocked(getProcessById).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes/proc-1/hypothesis');
    await POST(req, withParams({ id: 'client-1', processId: 'proc-1' }));

    expect(mockExecuteAI).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSlug: 'process-hypothesis',
        params: { processId: 'proc-1' },
        overrides: expect.objectContaining({
          templateVars: expect.objectContaining({
            clientName: 'Acme Corp',
            processName: 'Purchasing',
          }),
        }),
      }),
    );
  });
});
