// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks (before imports) ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

const mockStreamText = vi.fn();
const mockConvertToModelMessages = vi.fn();
const mockStepCountIs = vi.fn().mockReturnValue({ type: 'stepCount', count: 5 });
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  convertToModelMessages: (...args: unknown[]) => mockConvertToModelMessages(...args),
  stepCountIs: (...args: unknown[]) => mockStepCountIs(...args),
}));

const mockCreateAnthropic = vi.fn();
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}));

vi.mock('@/lib/domain/l1', () => ({
  getL1: vi.fn().mockReturnValue({ name: 'procurement', steps: [] }),
}));

vi.mock('@/lib/db/queries/research-notes', () => ({
  createResearchNote: vi.fn().mockResolvedValue({ id: 'note-1' }),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/ai/research/route';
import { getClientById } from '@/lib/db/queries/clients';
import { getProcessById } from '@/lib/db/queries/processes';
import { createResearchNote } from '@/lib/db/queries/research-notes';

// --- Helpers ---

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ADMIN_META = {
  publicMetadata: { role: 'admin', aiModels: { research: 'claude-sonnet-4-20250514' } },
  privateMetadata: { anthropicApiKey: 'sk-ant-test-key' },
};

const MESSAGES = [
  {
    id: '1',
    role: 'user',
    parts: [{ type: 'text', text: 'Tell me about procurement patterns' }],
  },
];

// --- Tests ---

describe('POST /api/ai/research', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertToModelMessages.mockResolvedValue([
      { role: 'user', content: 'Tell me about procurement patterns' },
    ]);

    // Default anthropic mock
    const mockProvider = Object.assign(
      (modelId: string) => ({ modelId }),
      {
        tools: {
          webSearch_20250305: vi.fn().mockReturnValue({ type: 'web_search' }),
        },
      }
    );
    mockCreateAnthropic.mockReturnValue(mockProvider);

    // Default streamText mock
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: () => new Response('stream-ok'),
    });
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest({ messages: MESSAGES });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest({ messages: MESSAGES });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 422 if no API key in privateMetadata', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
      privateMetadata: {},
    });
    const req = createRequest({ messages: MESSAGES });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('calls streamText with correct model from user preferences', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    const req = createRequest({ messages: MESSAGES });
    await POST(req);

    expect(mockCreateAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test-key' });
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { modelId: 'claude-sonnet-4-20250514' },
      })
    );
  });

  it('passes client context in system prompt when clientId provided', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    vi.mocked(getClientById).mockResolvedValue({
      id: 'c1', name: 'Acme Corp', industry: 'Manufacturing', aiSummary: 'Big company',
    } as any);

    const req = createRequest({ messages: MESSAGES, clientId: 'c1' });
    await POST(req);

    const call = mockStreamText.mock.calls[0][0];
    expect(call.system).toContain('Acme Corp');
    expect(call.system).toContain('Manufacturing');
  });

  it('passes process + L1 domain context when processId provided', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    vi.mocked(getProcessById).mockResolvedValue({
      id: 'p1', name: 'PO Process', processTypeL1: 'procurement', hypothesisText: 'Initial hypothesis',
    } as any);

    const req = createRequest({ messages: MESSAGES, processId: 'p1' });
    await POST(req);

    const call = mockStreamText.mock.calls[0][0];
    expect(call.system).toContain('PO Process');
    expect(call.system).toContain('procurement');
  });

  it('calls createResearchNote in onFinish when clientId is present', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    vi.mocked(getClientById).mockResolvedValue({ id: 'c1', name: 'Acme' } as any);

    // Capture onFinish callback
    let capturedOnFinish: (args: { text: string }) => Promise<void>;
    mockStreamText.mockImplementation((opts: any) => {
      capturedOnFinish = opts.onFinish;
      return { toUIMessageStreamResponse: () => new Response('ok') };
    });

    const req = createRequest({ messages: MESSAGES, clientId: 'c1' });
    await POST(req);

    // Simulate onFinish
    await capturedOnFinish!({ text: 'Research response about procurement' });

    expect(createResearchNote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'c1',
        query: 'Tell me about procurement patterns',
        response: 'Research response about procurement',
        sources: [],
      })
    );
    // Must NOT contain createdBy — schema has no such column
    expect(createResearchNote).toHaveBeenCalledWith(
      expect.not.objectContaining({ createdBy: expect.anything() })
    );
  });

  it('does NOT call createResearchNote when no clientId in body', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });

    let capturedOnFinish: (args: { text: string }) => Promise<void>;
    mockStreamText.mockImplementation((opts: any) => {
      capturedOnFinish = opts.onFinish;
      return { toUIMessageStreamResponse: () => new Response('ok') };
    });

    const req = createRequest({ messages: MESSAGES });
    await POST(req);

    await capturedOnFinish!({ text: 'Some response' });
    expect(createResearchNote).not.toHaveBeenCalled();
  });

  it('includes web_search tool in streamText call', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    const req = createRequest({ messages: MESSAGES });
    await POST(req);

    const call = mockStreamText.mock.calls[0][0];
    expect(call.tools).toHaveProperty('web_search');
    expect(call.tools.web_search).toEqual({ type: 'web_search' });
  });

  it('uses stopWhen with stepCountIs in streamText call', async () => {
    setupClerkMocks({ isAuthenticated: true, ...ADMIN_META });
    const req = createRequest({ messages: MESSAGES });
    await POST(req);

    const call = mockStreamText.mock.calls[0][0];
    // AI SDK v6 uses stopWhen, not maxSteps
    expect(call.stopWhen).toBeDefined();
  });

  it('falls back to claude-sonnet-4-20250514 when no user model preference', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
      privateMetadata: { anthropicApiKey: 'sk-ant-test-key' },
    });
    const req = createRequest({ messages: MESSAGES });
    await POST(req);

    // The provider function should be called with default model
    const providerFn = mockCreateAnthropic.mock.results[0].value;
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: providerFn('claude-sonnet-4-20250514'),
      })
    );
  });
});
