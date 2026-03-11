import { describe, it, expect, vi } from 'vitest';

// Mock DB dependencies to avoid env validation
vi.mock('@/lib/env', () => ({
  env: { DATABASE_URL: 'postgresql://test:test@localhost:6543/test' },
}));

vi.mock('postgres', () => ({
  default: () => ({}),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: () => ({}),
}));

describe('Process Query Functions — Contract Tests', () => {
  it('softDeleteProcess exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.softDeleteProcess).toBe('function');
  });

  it('updateProcess exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.updateProcess).toBe('function');
  });

  it('updateProcessModel exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.updateProcessModel).toBe('function');
  });

  it('getProcessWithModel exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.getProcessWithModel).toBe('function');
  });
});
