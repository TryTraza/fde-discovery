import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = { ...process.env }
  vi.resetModules()
})

afterEach(() => {
  process.env = originalEnv
})

function setAllRequiredEnvVars() {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc'
  process.env.CLERK_SECRET_KEY = 'sk_test_abc'
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = '/sign-in'
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL = '/sign-up'
  process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db'
  process.env.DATABASE_POOLED_URL = 'postgresql://user:pass@host-pooler.neon.tech/db'
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test'
}

describe('env validation', () => {
  it('throws when DATABASE_URL is missing', async () => {
    setAllRequiredEnvVars()
    delete process.env.DATABASE_URL
    await expect(() => import('@/lib/env')).rejects.toThrow()
  })

  it('throws when DATABASE_POOLED_URL is missing', async () => {
    setAllRequiredEnvVars()
    delete process.env.DATABASE_POOLED_URL
    await expect(() => import('@/lib/env')).rejects.toThrow()
  })

  it('throws when CLERK_SECRET_KEY is missing', async () => {
    setAllRequiredEnvVars()
    delete process.env.CLERK_SECRET_KEY
    await expect(() => import('@/lib/env')).rejects.toThrow()
  })

  it('throws when BLOB_READ_WRITE_TOKEN is missing', async () => {
    setAllRequiredEnvVars()
    delete process.env.BLOB_READ_WRITE_TOKEN
    await expect(() => import('@/lib/env')).rejects.toThrow()
  })

  it('parses successfully when all vars present', async () => {
    setAllRequiredEnvVars()
    const { env } = await import('@/lib/env')
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@host.neon.tech/db')
    expect(env.DATABASE_POOLED_URL).toBe('postgresql://user:pass@host-pooler.neon.tech/db')
    expect(env.BLOB_READ_WRITE_TOKEN).toBe('vercel_blob_rw_test')
  })

  it('uses defaults for optional sign-in/sign-up URLs', async () => {
    setAllRequiredEnvVars()
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL
    delete process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL
    const { env } = await import('@/lib/env')
    expect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe('/sign-in')
    expect(env.NEXT_PUBLIC_CLERK_SIGN_UP_URL).toBe('/sign-up')
  })
})
