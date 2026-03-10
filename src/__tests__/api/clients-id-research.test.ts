// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/ai/prompts/company-research', () => ({
  triggerCompanyResearch: vi.fn(),
}));

import { POST } from '@/app/api/clients/[id]/research/route';
import { getClientById } from '@/lib/db/queries/clients';
import { triggerCompanyResearch } from '@/lib/ai/prompts/company-research';

function withParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/clients/[id]/research', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = new Request('http://localhost/api/clients/c1/research', { method: 'POST' });
    const res = await POST(req, withParams('c1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'viewer' } });
    const req = new Request('http://localhost/api/clients/c1/research', { method: 'POST' });
    const res = await POST(req, withParams('c1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when client not found', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    vi.mocked(getClientById).mockResolvedValue(null as any);

    const req = new Request('http://localhost/api/clients/nonexistent/research', { method: 'POST' });
    const res = await POST(req, withParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 200 and triggers research when client exists', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const client = { id: 'c1', name: 'Acme Corp', industry: 'Tech', website: 'https://acme.com' };
    vi.mocked(getClientById).mockResolvedValue(client as any);

    const req = new Request('http://localhost/api/clients/c1/research', { method: 'POST' });
    const res = await POST(req, withParams('c1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ message: 'Research started' });
  });

  it('calls triggerCompanyResearch with client data', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: { role: 'admin' } });
    const client = { id: 'c1', name: 'Acme Corp', industry: 'Tech', website: 'https://acme.com' };
    vi.mocked(getClientById).mockResolvedValue(client as any);

    const req = new Request('http://localhost/api/clients/c1/research', { method: 'POST' });
    await POST(req, withParams('c1'));

    expect(triggerCompanyResearch).toHaveBeenCalledWith('c1', 'Acme Corp', 'Tech', 'https://acme.com');
  });
});
