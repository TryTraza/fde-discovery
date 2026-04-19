import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { DATABASE_URL: 'postgresql://test:test@localhost:6543/test' },
}))

vi.mock('postgres', () => ({
  default: () => ({}),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: () => ({}),
}))

describe('client-research query functions — contract tests', () => {
  it('getResearchByClientId exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/client-research')
    expect(typeof queries.getResearchByClientId).toBe('function')
  })

  it('upsertClientResearch exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/client-research')
    expect(typeof queries.upsertClientResearch).toBe('function')
  })

  it('deleteResearchByClientId exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/client-research')
    expect(typeof queries.deleteResearchByClientId).toBe('function')
  })
})
