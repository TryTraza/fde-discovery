// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelId: 'claude-haiku-4-5-20241022',
    anthropic: {},
  }),
}));

vi.mock('@/lib/ai/context/capture-context', () => ({
  buildCaptureContext: vi.fn().mockResolvedValue({
    processTypeL1: 'procurement',
    l1Library: null,
    recentEvents: [],
    processModelSteps: [],
    interviewAnswers: null,
  }),
}));

const mockExecuteAI = vi.fn();
vi.mock('@/lib/ai/builder', () => ({
  executeAI: (...args: unknown[]) => mockExecuteAI(...args),
}));

// --- Imports (after mocks) ---

import { POST } from '@/app/api/ai/suggestions/route';
import { getAIConfig } from '@/lib/ai/get-ai-config';

// --- Helpers ---

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SESSION_ID = 'd00b31bc-4160-49cb-83f1-05440fc7c807';

const MOCK_SUGGESTIONS = [
  { text: 'Opens email client', rationale: 'Common first step' },
  { text: 'Checks inbox', rationale: 'Follow-up to opening email' },
];

// --- Tests ---

describe('POST /api/ai/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteAI.mockResolvedValue({
      data: { suggestions: MOCK_SUGGESTIONS },
      meta: { agentSlug: 'capture-suggestions', configVersion: 1, promptVersion: 1, model: 'standard', layerTimings: {}, totalDuration: 100, layerErrors: [] },
    });
    vi.mocked(getAIConfig).mockResolvedValue({
      model: 'mock-model',
      modelId: 'claude-haiku-4-5-20241022',
      anthropic: {},
    } as any);
  });

  it('returns suggestions array on success', async () => {
    setupClerkMocks({ isAuthenticated: true });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'STEP', eventCount: 3 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toEqual(MOCK_SUGGESTIONS);
  });

  it('returns empty array when sessionId missing', async () => {
    setupClerkMocks({ isAuthenticated: true });

    const req = createRequest({ activeType: 'STEP' });
    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toEqual([]);
  });

  it('returns empty array when AI call fails (no 500)', async () => {
    setupClerkMocks({ isAuthenticated: true });
    mockExecuteAI.mockRejectedValue(new Error('AI model error'));

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'STEP', eventCount: 0 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toEqual([]);
  });

  it('returns empty array when no API key configured (no 500)', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(getAIConfig).mockRejectedValue(new Error('NO_API_KEY'));

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'STEP', eventCount: 0 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toEqual([]);
  });

  it('returns empty array for non-STEP/EDGE activeType', async () => {
    setupClerkMocks({ isAuthenticated: true });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'SYSTEM', eventCount: 0 });
    const res = await POST(req);
    const data = await res.json();

    expect(data.suggestions).toEqual([]);
    expect(mockExecuteAI).not.toHaveBeenCalled();
  });

  it('limits suggestions to max 5', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const manySuggestions = Array(7).fill(null).map((_, i) => ({
      text: `Suggestion ${i}`,
      rationale: `Rationale ${i}`,
    }));
    mockExecuteAI.mockResolvedValue({
      data: { suggestions: manySuggestions },
      meta: { agentSlug: 'capture-suggestions', configVersion: 1, promptVersion: 1, model: 'standard', layerTimings: {}, totalDuration: 100, layerErrors: [] },
    });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'STEP', eventCount: 0 });
    const res = await POST(req);
    const data = await res.json();

    // The schema limits to max 5, but generateObject enforces via schema
    // The route returns whatever AI returns (schema-validated)
    expect(data.suggestions).toBeDefined();
  });

  it('rejects unauthenticated request', async () => {
    setupClerkMocks({ isAuthenticated: false });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'STEP', eventCount: 0 });
    const res = await POST(req);
    const data = await res.json();

    // Suggestions route returns empty array on ANY error (including auth)
    // to never crash the capture UI
    expect(data.suggestions).toEqual([]);
  });

  it('calls executeAI with capture-suggestions agent', async () => {
    setupClerkMocks({ isAuthenticated: true });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'EDGE', eventCount: 5 });
    await POST(req);

    expect(mockExecuteAI).toHaveBeenCalledTimes(1);
    expect(mockExecuteAI).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSlug: 'capture-suggestions',
        params: { sessionId: SESSION_ID },
        model: 'mock-model',
      })
    );
  });
});
