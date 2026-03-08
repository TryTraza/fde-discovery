import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  vi.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
});

function setAllRequiredEnvVars() {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
  process.env.CLERK_SECRET_KEY = 'sk_test_abc';
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = '/sign-in';
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL = '/sign-up';
  process.env.DATABASE_URL = 'postgresql://user:pass@host:6543/db';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
}

describe('env validation', () => {
  it('throws when DATABASE_URL is missing', async () => {
    setAllRequiredEnvVars();
    delete process.env.DATABASE_URL;
    await expect(() => import('@/lib/env')).rejects.toThrow();
  });

  it('throws when CLERK_SECRET_KEY is missing', async () => {
    setAllRequiredEnvVars();
    delete process.env.CLERK_SECRET_KEY;
    await expect(() => import('@/lib/env')).rejects.toThrow();
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', async () => {
    setAllRequiredEnvVars();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    await expect(() => import('@/lib/env')).rejects.toThrow();
  });

  it('parses successfully when all vars present', async () => {
    setAllRequiredEnvVars();
    const { env } = await import('@/lib/env');
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@host:6543/db');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co');
  });

  it('uses defaults for optional sign-in/sign-up URLs', async () => {
    setAllRequiredEnvVars();
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe('/sign-in');
    expect(env.NEXT_PUBLIC_CLERK_SIGN_UP_URL).toBe('/sign-up');
  });
});
