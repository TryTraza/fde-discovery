// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuth, mockClerkClient, setupClerkMocks } from './mocks/clerk';

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}));

import { requireUserId, requireAuthWithUser, requireAdmin, handleAPIError } from '@/lib/auth/utils';

describe('requireUserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    await expect(requireUserId()).rejects.toThrow('Unauthorized');
  });

  it('returns userId when authenticated', async () => {
    setupClerkMocks({ isAuthenticated: true, userId: 'user_123' });
    const id = await requireUserId();
    expect(id).toBe('user_123');
  });
});

describe('requireAuthWithUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false });
    await expect(requireAuthWithUser()).rejects.toThrow('Unauthorized');
  });

  it('returns userId, role, and user when authenticated', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      userId: 'user_123',
      publicMetadata: { role: 'admin' },
    });
    const result = await requireAuthWithUser();
    expect(result.userId).toBe('user_123');
    expect(result.role).toBe('admin');
    expect(result.user).toBeDefined();
  });

  it('defaults role to viewer when no role in metadata', async () => {
    setupClerkMocks({ isAuthenticated: true, publicMetadata: {} });
    const result = await requireAuthWithUser();
    expect(result.role).toBe('viewer');
  });
});

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws Forbidden when role is viewer', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'viewer' },
    });
    await expect(requireAdmin()).rejects.toThrow('Forbidden: admin role required');
  });

  it('passes when role is admin', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      publicMetadata: { role: 'admin' },
    });
    const result = await requireAdmin();
    expect(result.role).toBe('admin');
  });
});

describe('handleAPIError', () => {
  it('maps NO_API_KEY to 422', () => {
    const res = handleAPIError(new Error('NO_API_KEY'));
    expect(res.status).toBe(422);
  });

  it('maps Unauthorized to 401', () => {
    const res = handleAPIError(new Error('Unauthorized'));
    expect(res.status).toBe(401);
  });

  it('maps Forbidden: admin role required to 403', () => {
    const res = handleAPIError(new Error('Forbidden: admin role required'));
    expect(res.status).toBe(403);
  });

  it('maps invalid_api_key to 422', () => {
    const res = handleAPIError(new Error('Anthropic error: invalid_api_key'));
    expect(res.status).toBe(422);
  });

  it('maps rate_limit to 429', () => {
    const res = handleAPIError(new Error('rate_limit_exceeded'));
    expect(res.status).toBe(429);
  });

  it('maps unknown errors to 500', () => {
    const res = handleAPIError(new Error('something random'));
    expect(res.status).toBe(500);
  });

  it('does NOT match partial strings — SomeUnauthorizedThing is 500, not 401', () => {
    const res = handleAPIError(new Error('SomeUnauthorizedThing'));
    expect(res.status).toBe(500);
  });

  it('does NOT match partial strings — SomeForbiddenThing is 500, not 403', () => {
    const res = handleAPIError(new Error('SomeForbiddenThing'));
    expect(res.status).toBe(500);
  });
});
