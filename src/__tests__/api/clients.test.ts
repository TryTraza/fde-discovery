// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

// --- Mocks ---

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai/prompts/company-research', () => ({
  triggerCompanyResearch: vi.fn(),
}));

// --- Imports (after mocks) ---

import { GET, POST } from '@/app/api/clients/route';
import { listClients, createClient } from '@/lib/db/queries/clients';
import { triggerCompanyResearch } from '@/lib/ai/prompts/company-research';

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

// --- Tests ---

describe('GET /api/clients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('GET', 'http://localhost/api/clients');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns client list', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const mockClients = [
      { id: 'c1', name: 'Acme Corp' },
      { id: 'c2', name: 'Globex Inc' },
    ];
    vi.mocked(listClients).mockResolvedValue(mockClients as any);

    const req = createRequest('GET', 'http://localhost/api/clients');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockClients);
  });

  it('passes search/status/industry filters to listClients', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(listClients).mockResolvedValue([]);

    const req = createRequest(
      'GET',
      'http://localhost/api/clients?search=acme&status=active_poc&industry=Tech'
    );
    await GET(req);

    expect(listClients).toHaveBeenCalledWith({
      search: 'acme',
      status: ['active_poc'],
      industry: ['Tech'],
    });
  });
});

describe('POST /api/clients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('POST', 'http://localhost/api/clients', {
      name: 'Test',
      industry: 'Tech',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('POST', 'http://localhost/api/clients', {
      name: 'Test',
      industry: 'Tech',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body (missing name)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest('POST', 'http://localhost/api/clients', {
      industry: 'Tech',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('details');
  });

  it('returns 201 with created client for valid body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const newClient = {
      id: 'c-new',
      name: 'New Corp',
      industry: 'Finance',
      website: 'https://newcorp.com',
    };
    vi.mocked(createClient).mockResolvedValue(newClient as any);

    const req = createRequest('POST', 'http://localhost/api/clients', {
      name: 'New Corp',
      industry: 'Finance',
      website: 'https://newcorp.com',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(newClient);
  });

  it('triggers triggerCompanyResearch fire-and-forget after creation', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const newClient = {
      id: 'c-new',
      name: 'New Corp',
      industry: 'Finance',
      website: 'https://newcorp.com',
    };
    vi.mocked(createClient).mockResolvedValue(newClient as any);

    const req = createRequest('POST', 'http://localhost/api/clients', {
      name: 'New Corp',
      industry: 'Finance',
      website: 'https://newcorp.com',
    });
    await POST(req);

    expect(triggerCompanyResearch).toHaveBeenCalledWith(
      'c-new',
      'New Corp',
      'Finance',
      'https://newcorp.com'
    );
  });

  it('returns 400 for malformed JSON body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createBadJsonRequest('POST', 'http://localhost/api/clients');
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid JSON' });
  });
});
