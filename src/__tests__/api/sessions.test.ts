// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/sessions', () => ({
  listSessionsByProcess: vi.fn(),
  createSession: vi.fn(),
  createSessionContacts: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}));

vi.mock('@/lib/db/queries/contacts', () => ({
  getContactsByIds: vi.fn(),
}));

// --- Imports (after mocks) ---

import { GET, POST } from '@/app/api/sessions/route';
import { listSessionsByProcess, createSession, createSessionContacts } from '@/lib/db/queries/sessions';
import { getProcessById } from '@/lib/db/queries/processes';
import { getContactsByIds } from '@/lib/db/queries/contacts';

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

const VALID_UUID = 'd00b31bc-4160-49cb-83f1-05440fc7c807';
const VALID_UUID_2 = 'a418704c-3e2c-451a-8eb3-0257bcb26016';
const CONTACT_UUID = 'e0e7c0e4-cf5a-4856-b42a-3c8bda1d3c8d';
const CONTACT_UUID_2 = '30ea39a2-c903-401c-917b-ebdac4784fbe';

const VALID_SESSION_BODY = {
  processId: VALID_UUID,
  type: 'discovery',
  title: 'Test Session',
  date: '2026-03-16',
};

// --- GET /api/sessions tests ---

describe('GET /api/sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('GET', `http://localhost/api/sessions?processId=${VALID_UUID}`);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when processId is missing', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const req = createRequest('GET', 'http://localhost/api/sessions');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when processId is not a valid UUID', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const req = createRequest('GET', 'http://localhost/api/sessions?processId=not-a-uuid');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns sessions list for valid processId', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const mockSessions = [
      { id: 's1', title: 'Session 1', type: 'discovery', status: 'planned' },
    ];
    vi.mocked(listSessionsByProcess).mockResolvedValue(mockSessions as any);

    const req = createRequest('GET', `http://localhost/api/sessions?processId=${VALID_UUID}`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockSessions);
    expect(listSessionsByProcess).toHaveBeenCalledWith(VALID_UUID);
  });

  it('returns empty array when no sessions exist', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(listSessionsByProcess).mockResolvedValue([]);

    const req = createRequest('GET', `http://localhost/api/sessions?processId=${VALID_UUID}`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

// --- POST /api/sessions tests ---

describe('POST /api/sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for malformed JSON', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createBadJsonRequest('POST', 'http://localhost/api/sessions');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest('POST', 'http://localhost/api/sessions', { processId: VALID_UUID });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid session type', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      type: 'invalid_type',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date string', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      date: 'not-a-date',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when process does not exist', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue(null as any);

    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Process not found');
  });

  it('returns 400 when contactIds reference invalid contacts', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ id: VALID_UUID } as any);
    vi.mocked(getContactsByIds).mockResolvedValue([{ id: CONTACT_UUID }] as any); // Only 1 found

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID_2], // 2 requested
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('contactIds');
  });

  it('creates session with no contacts and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ id: VALID_UUID } as any);
    const mockSession = { id: 's1', ...VALID_SESSION_BODY, status: 'planned', createdBy: 'user_test123' };
    vi.mocked(createSession).mockResolvedValue(mockSession as any);

    const req = createRequest('POST', 'http://localhost/api/sessions', VALID_SESSION_BODY);
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe('s1');
    expect(data.createdBy).toBe('user_test123');
    expect(createSessionContacts).not.toHaveBeenCalled();
  });

  it('creates session with contacts and returns 201', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ id: VALID_UUID } as any);
    vi.mocked(getContactsByIds).mockResolvedValue([
      { id: CONTACT_UUID },
      { id: CONTACT_UUID_2 },
    ] as any);
    const mockSession = { id: 's1', ...VALID_SESSION_BODY, status: 'planned' };
    vi.mocked(createSession).mockResolvedValue(mockSession as any);

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID_2],
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(createSessionContacts).toHaveBeenCalledWith('s1', [CONTACT_UUID, CONTACT_UUID_2], {});
  });

  it('deduplicates contactIds', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ id: VALID_UUID } as any);
    vi.mocked(getContactsByIds).mockResolvedValue([{ id: CONTACT_UUID }] as any);
    vi.mocked(createSession).mockResolvedValue({ id: 's1' } as any);

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      contactIds: [CONTACT_UUID, CONTACT_UUID, CONTACT_UUID],
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    // getContactsByIds should be called with deduplicated array
    expect(vi.mocked(getContactsByIds).mock.calls[0][0]).toHaveLength(1);
  });

  it('stores interviewAnswers as JSONB', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getProcessById).mockResolvedValue({ id: VALID_UUID } as any);
    const answers = { questions: [{ question: 'Q1', answer: 'A1' }] };
    vi.mocked(createSession).mockResolvedValue({ id: 's1', interviewAnswers: answers } as any);

    const req = createRequest('POST', 'http://localhost/api/sessions', {
      ...VALID_SESSION_BODY,
      interviewAnswers: answers,
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(vi.mocked(createSession).mock.calls[0][0]).toMatchObject({
      interviewAnswers: answers,
    });
  });
});
