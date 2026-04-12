import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to reset the singleton between tests
// The module uses a module-level variable, so we need dynamic imports + module reset

describe('getLangfuseClient', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clean env before each test
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_BASE_URL;
  });

  it('returns a Langfuse instance when env vars are set', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test-secret';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test-public';

    const { getLangfuseClient } = await import('@/lib/ai/observe');
    const client = getLangfuseClient();
    expect(client).not.toBeNull();
  });

  it('returns null when LANGFUSE_SECRET_KEY is missing', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test-public';
    // No LANGFUSE_SECRET_KEY

    const { getLangfuseClient } = await import('@/lib/ai/observe');
    const client = getLangfuseClient();
    expect(client).toBeNull();
  });

  it('returns null when LANGFUSE_PUBLIC_KEY is missing', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test-secret';
    // No LANGFUSE_PUBLIC_KEY

    const { getLangfuseClient } = await import('@/lib/ai/observe');
    const client = getLangfuseClient();
    expect(client).toBeNull();
  });

  it('is a singleton — returns same instance on repeated calls', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test-secret';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test-public';

    const { getLangfuseClient } = await import('@/lib/ai/observe');
    const first = getLangfuseClient();
    const second = getLangfuseClient();
    expect(first).toBe(second);
  });

  it('never throws even if Langfuse constructor fails', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test-secret';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test-public';

    // Mock Langfuse to throw on construction
    vi.doMock('langfuse', () => ({
      Langfuse: class {
        constructor() {
          throw new Error('Connection failed');
        }
      },
    }));

    const { getLangfuseClient } = await import('@/lib/ai/observe');
    expect(() => getLangfuseClient()).not.toThrow();
    expect(getLangfuseClient()).toBeNull();
  });
});
