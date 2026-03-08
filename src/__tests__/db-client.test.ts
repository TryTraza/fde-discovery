import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPostgres = vi.fn().mockReturnValue({});
const mockDrizzle = vi.fn().mockReturnValue({});

vi.mock('postgres', () => ({
  default: (...args: unknown[]) => mockPostgres(...args),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

vi.mock('@/lib/env', () => ({
  env: { DATABASE_URL: 'postgresql://test:test@localhost:6543/test' },
}));

describe('DB client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes prepare: false to postgres constructor', async () => {
    vi.resetModules();

    // Re-mock after reset
    vi.doMock('postgres', () => ({
      default: (...args: unknown[]) => {
        mockPostgres(...args);
        return {};
      },
    }));
    vi.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: (...args: unknown[]) => {
        mockDrizzle(...args);
        return {};
      },
    }));
    vi.doMock('@/lib/env', () => ({
      env: { DATABASE_URL: 'postgresql://test:test@localhost:6543/test' },
    }));

    await import('@/lib/db/index');

    expect(mockPostgres).toHaveBeenCalledWith(
      'postgresql://test:test@localhost:6543/test',
      { prepare: false }
    );
  });
});
