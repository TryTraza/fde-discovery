// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

const mockGenerateText = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue((model: string) => ({ model })),
}))

import { POST } from '@/app/api/settings/test-key/route'

describe('POST /api/settings/test-key', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 422 when no key stored', async () => {
    setupClerkMocks({ isAuthenticated: true, privateMetadata: {} })
    const res = await POST()
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toContain('No API key stored')
  })

  it('returns valid when key works', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-valid' },
    })
    mockGenerateText.mockResolvedValueOnce({ text: 'ok' })
    const res = await POST()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.valid).toBe(true)
  })

  it('returns error when key is invalid', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-invalid' },
    })
    mockGenerateText.mockRejectedValueOnce(new Error('invalid_api_key'))
    const res = await POST()
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toContain('Invalid API key')
  })
})
