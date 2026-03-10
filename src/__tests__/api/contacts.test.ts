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

vi.mock('@/lib/db/queries/contacts', () => ({
  listContactsByClient: vi.fn(),
  createContact: vi.fn(),
  getContactById: vi.fn(),
  updateContact: vi.fn(),
  softDeleteContact: vi.fn(),
}));

// --- Imports (after mocks) ---

import { GET as getClientContacts, POST } from '@/app/api/clients/[id]/contacts/route';
import { GET as getContact, PATCH, DELETE } from '@/app/api/contacts/[id]/route';
import { getClientById } from '@/lib/db/queries/clients';
import {
  listContactsByClient,
  createContact,
  getContactById,
  updateContact,
  softDeleteContact,
} from '@/lib/db/queries/contacts';

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

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// --- Tests: GET /api/clients/[id]/contacts ---

describe('GET /api/clients/[id]/contacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = createRequest('GET', 'http://localhost/api/clients/c1/contacts');
    const res = await getClientContacts(req, withParams('c1'));
    expect(res.status).toBe(401);
  });

  it('returns contact list', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const mockContacts = [{ id: 'ct1', name: 'John' }];
    vi.mocked(listContactsByClient).mockResolvedValue(mockContacts as any);

    const req = createRequest('GET', 'http://localhost/api/clients/c1/contacts');
    const res = await getClientContacts(req, withParams('c1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockContacts);
  });
});

// --- Tests: POST /api/clients/[id]/contacts ---

describe('POST /api/clients/[id]/contacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('POST', 'http://localhost/api/clients/c1/contacts', { name: 'Jane' });
    const res = await POST(req, withParams('c1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent client regardless of body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(null as any);

    const req = createRequest('POST', 'http://localhost/api/clients/ghost/contacts', { name: 'John' });
    const res = await POST(req, withParams('ghost'));
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid body (missing name)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue({ id: 'c1', name: 'Acme' } as any);

    const req = createRequest('POST', 'http://localhost/api/clients/c1/contacts', {});
    const res = await POST(req, withParams('c1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('details');
  });

  it('returns 201 with created contact for valid body', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue({ id: 'c1', name: 'Acme' } as any);
    const newContact = { id: 'ct-new', name: 'Jane Doe', clientId: 'c1' };
    vi.mocked(createContact).mockResolvedValue(newContact as any);

    const req = createRequest('POST', 'http://localhost/api/clients/c1/contacts', { name: 'Jane Doe' });
    const res = await POST(req, withParams('c1'));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(newContact);
  });

  it('returns 400 for malformed JSON (client exists)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue({ id: 'c1', name: 'Acme' } as any);

    const req = createBadJsonRequest('POST', 'http://localhost/api/clients/c1/contacts');
    const res = await POST(req, withParams('c1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid JSON' });
  });
});

// --- Tests: GET /api/contacts/[id] ---

describe('GET /api/contacts/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when not found', async () => {
    setupClerkMocks({ isAuthenticated: true });
    vi.mocked(getContactById).mockResolvedValue(null as any);

    const req = createRequest('GET', 'http://localhost/api/contacts/nonexistent');
    const res = await getContact(req, withParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with contact when found', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const contact = { id: 'ct1', name: 'John', clientId: 'c1' };
    vi.mocked(getContactById).mockResolvedValue(contact as any);

    const req = createRequest('GET', 'http://localhost/api/contacts/ct1');
    const res = await getContact(req, withParams('ct1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(contact);
  });
});

// --- Tests: PATCH /api/contacts/[id] ---

describe('PATCH /api/contacts/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('PATCH', 'http://localhost/api/contacts/ct1', { name: 'Updated' });
    const res = await PATCH(req, withParams('ct1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body (empty name)', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const req = createRequest('PATCH', 'http://localhost/api/contacts/ct1', { name: '' });
    const res = await PATCH(req, withParams('ct1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(updateContact).mockResolvedValue(null as any);

    const req = createRequest('PATCH', 'http://localhost/api/contacts/nonexistent', { name: 'Updated' });
    const res = await PATCH(req, withParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated contact on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const updated = { id: 'ct1', name: 'Updated Name' };
    vi.mocked(updateContact).mockResolvedValue(updated as any);

    const req = createRequest('PATCH', 'http://localhost/api/contacts/ct1', { name: 'Updated Name' });
    const res = await PATCH(req, withParams('ct1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(updated);
  });
});

// --- Tests: DELETE /api/contacts/[id] ---

describe('DELETE /api/contacts/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = createRequest('DELETE', 'http://localhost/api/contacts/ct1');
    const res = await DELETE(req, withParams('ct1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(softDeleteContact).mockResolvedValue(null as any);

    const req = createRequest('DELETE', 'http://localhost/api/contacts/nonexistent');
    const res = await DELETE(req, withParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with message on success', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(softDeleteContact).mockResolvedValue({ id: 'ct1' } as any);

    const req = createRequest('DELETE', 'http://localhost/api/contacts/ct1');
    const res = await DELETE(req, withParams('ct1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ message: 'Contact deleted' });
  });
});
