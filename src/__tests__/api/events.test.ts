// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/events', () => ({
  createEvent: vi.fn(),
  getEventsBySessionId: vi.fn(),
  updateEventLabel: vi.fn(),
  updateEventDetail: vi.fn(),
}));

// --- Imports (after mocks) ---

import { GET, POST } from '@/app/api/sessions/[sessionId]/events/route';
import { PATCH } from '@/app/api/sessions/[sessionId]/events/[eventId]/route';
import {
  createEvent,
  getEventsBySessionId,
  updateEventLabel,
  updateEventDetail,
} from '@/lib/db/queries/events';

// --- Helpers ---

function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function withSessionParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function withEventParams(sessionId: string, eventId: string) {
  return { params: Promise.resolve({ sessionId, eventId }) };
}

const SESSION_ID = 'd00b31bc-4160-49cb-83f1-05440fc7c807';
const EVENT_ID = 'a418704c-3e2c-451a-8eb3-0257bcb26016';

const VALID_EVENT_BODY = {
  timestamp: '2026-03-21T10:00:00.000Z',
  type: 'STEP',
  label: 'Opens email client',
};

const MOCK_EVENT = {
  id: EVENT_ID,
  sessionId: SESSION_ID,
  timestamp: new Date('2026-03-21T10:00:00.000Z'),
  type: 'STEP',
  label: 'Opens email client',
  detail: null,
  suggestionUsed: false,
  createdAt: new Date(),
};

// --- POST /api/sessions/[sessionId]/events ---

describe('POST /api/sessions/[sessionId]/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a STEP event with label and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(createEvent).mockResolvedValue(MOCK_EVENT as any);

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, VALID_EVENT_BODY);
    const res = await POST(req, withSessionParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.type).toBe('STEP');
    expect(data.label).toBe('Opens email client');
  });

  it('creates an IMPLICIT event with null label', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const implicitEvent = { ...MOCK_EVENT, type: 'IMPLICIT', label: null };
    vi.mocked(createEvent).mockResolvedValue(implicitEvent as any);

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, {
      timestamp: '2026-03-21T10:01:00.000Z',
      type: 'IMPLICIT',
      label: null,
    });
    const res = await POST(req, withSessionParams(SESSION_ID));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.type).toBe('IMPLICIT');
    expect(data.label).toBeNull();
  });

  it('creates a SYSTEM event with detail notes', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const systemEvent = { ...MOCK_EVENT, type: 'SYSTEM', label: 'SAP', detail: 'Transaction VA01' };
    vi.mocked(createEvent).mockResolvedValue(systemEvent as any);

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, {
      timestamp: '2026-03-21T10:02:00.000Z',
      type: 'SYSTEM',
      label: 'SAP',
      detail: 'Transaction VA01',
    });
    const res = await POST(req, withSessionParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.type).toBe('SYSTEM');
    expect(data.detail).toBe('Transaction VA01');
  });

  it('rejects invalid event type with 400', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, {
      timestamp: '2026-03-21T10:00:00.000Z',
      type: 'INVALID_TYPE',
      label: 'test',
    });
    const res = await POST(req, withSessionParams(SESSION_ID));
    expect(res.status).toBe(400);
  });

  it('rejects missing timestamp with 400', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, {
      type: 'STEP',
      label: 'test',
    });
    const res = await POST(req, withSessionParams(SESSION_ID));
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated request with 401', async () => {
    setupClerkMocks({ isAuthenticated: false });

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, VALID_EVENT_BODY);
    const res = await POST(req, withSessionParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('rejects non-admin user with 403', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });

    const req = createRequest('POST', `http://localhost/api/sessions/${SESSION_ID}/events`, VALID_EVENT_BODY);
    const res = await POST(req, withSessionParams(SESSION_ID));
    expect(res.status).toBe(403);
  });
});

// --- GET /api/sessions/[sessionId]/events ---

describe('GET /api/sessions/[sessionId]/events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns events ordered by timestamp ascending', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const mockEvents = [
      { ...MOCK_EVENT, id: 'e1', label: 'Step 1' },
      { ...MOCK_EVENT, id: 'e2', label: 'Step 2' },
    ];
    vi.mocked(getEventsBySessionId).mockResolvedValue(mockEvents as any);

    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}/events`);
    const res = await GET(req, withSessionParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
  });

  it('returns empty array for session with no events', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(getEventsBySessionId).mockResolvedValue([]);

    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}/events`);
    const res = await GET(req, withSessionParams(SESSION_ID));
    const data = await res.json();

    expect(data).toEqual([]);
  });

  it('rejects unauthenticated request with 401', async () => {
    setupClerkMocks({ isAuthenticated: false });

    const req = createRequest('GET', `http://localhost/api/sessions/${SESSION_ID}/events`);
    const res = await GET(req, withSessionParams(SESSION_ID));
    expect(res.status).toBe(401);
  });
});

// --- PATCH /api/sessions/[sessionId]/events/[eventId] ---

describe('PATCH /api/sessions/[sessionId]/events/[eventId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates event label only and returns updated event', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const updatedEvent = { ...MOCK_EVENT, label: 'New label text' };
    vi.mocked(updateEventLabel).mockResolvedValue(updatedEvent as any);

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}/events/${EVENT_ID}`, {
      label: 'New label text',
    });
    const res = await PATCH(req, withEventParams(SESSION_ID, EVENT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.label).toBe('New label text');
  });

  it('updates event detail only and returns updated event', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const updatedEvent = { ...MOCK_EVENT, detail: '¿Por qué usan Excel?' };
    vi.mocked(updateEventDetail).mockResolvedValue(updatedEvent as any);

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}/events/${EVENT_ID}`, {
      detail: '¿Por qué usan Excel?',
    });
    const res = await PATCH(req, withEventParams(SESSION_ID, EVENT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.detail).toBe('¿Por qué usan Excel?');
  });

  it('rejects PATCH with empty body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}/events/${EVENT_ID}`, {});
    const res = await PATCH(req, withEventParams(SESSION_ID, EVENT_ID));
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent event', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(updateEventLabel).mockResolvedValue(null as any);

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}/events/${EVENT_ID}`, {
      label: 'test',
    });
    const res = await PATCH(req, withEventParams(SESSION_ID, EVENT_ID));
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated request with 401', async () => {
    setupClerkMocks({ isAuthenticated: false });

    const req = createRequest('PATCH', `http://localhost/api/sessions/${SESSION_ID}/events/${EVENT_ID}`, {
      label: 'test',
    });
    const res = await PATCH(req, withEventParams(SESSION_ID, EVENT_ID));
    expect(res.status).toBe(401);
  });
});
