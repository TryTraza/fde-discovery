// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk';

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

import { GET, PATCH } from '@/app/api/settings/route';

describe('GET /api/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns hasApiKey, aiModels, role when authenticated', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
      publicMetadata: { role: 'admin', aiModels: { research: 'claude-sonnet-4-6' } },
    });
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hasApiKey).toBe(true);
    expect(data.aiModels).toEqual({ research: 'claude-sonnet-4-6' });
    expect(data.role).toBe('admin');
  });

  it('does NOT return raw API key in response', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-secret123' },
    });
    const res = await GET();
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('sk-ant-secret123');
  });

  it('returns sensible defaults for fresh user', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: {},
      publicMetadata: {},
    });
    const res = await GET();
    const data = await res.json();
    expect(data.hasApiKey).toBe(false);
    expect(data.aiModels).toEqual({});
    expect(data.role).toBe('viewer');
  });
});

describe('PATCH /api/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: 'sk-ant-test' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('saves API key and sets hasApiKey in metadata', async () => {
    const { mockUpdateUserMetadata } = setupClerkMocks({ isAuthenticated: true });
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: 'sk-ant-test123' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
      privateMetadata: { anthropicApiKey: 'sk-ant-test123' },
      publicMetadata: { hasApiKey: true },
    });
  });

  it('saves model preferences', async () => {
    const { mockUpdateUserMetadata } = setupClerkMocks({ isAuthenticated: true });
    const models = { research: 'claude-sonnet-4-6', suggestions: 'claude-haiku-4-5-20241022' };
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ aiModels: models }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
      publicMetadata: { aiModels: models },
    });
  });

  it('returns 422 on empty body', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid body shape', async () => {
    setupClerkMocks({ isAuthenticated: true });
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ anthropicApiKey: '' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(422);
  });
});
