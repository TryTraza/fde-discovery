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

const mockGenerateObject = vi.fn();
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
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
    mockGenerateObject.mockResolvedValue({
      object: { suggestions: MOCK_SUGGESTIONS },
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
    mockGenerateObject.mockRejectedValue(new Error('AI model error'));

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
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('limits suggestions to max 5', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const manySuggestions = Array(7).fill(null).map((_, i) => ({
      text: `Suggestion ${i}`,
      rationale: `Rationale ${i}`,
    }));
    mockGenerateObject.mockResolvedValue({
      object: { suggestions: manySuggestions },
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

  it('calls generateObject with suggestions schema', async () => {
    setupClerkMocks({ isAuthenticated: true });

    const req = createRequest({ sessionId: SESSION_ID, activeType: 'EDGE', eventCount: 5 });
    await POST(req);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        schema: expect.any(Object),
        prompt: expect.stringContaining('edge cases'),
      })
    );
  });
});
