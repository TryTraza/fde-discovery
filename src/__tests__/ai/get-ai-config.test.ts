// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth, mockClerkClient, setupClerkMocks } from '../mocks/clerk'

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

const mockCreateAnthropic = vi.fn().mockReturnValue((model: string) => ({ model }))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}))

import { getAIConfig } from '@/lib/ai/get-ai-config'

describe('getAIConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when not authenticated', async () => {
    setupClerkMocks({ isAuthenticated: false })
    await expect(getAIConfig('research')).rejects.toThrow('Unauthorized')
  })

  it('throws NO_API_KEY when no key in metadata', async () => {
    setupClerkMocks({ isAuthenticated: true, privateMetadata: {} })
    await expect(getAIConfig('research')).rejects.toThrow('NO_API_KEY')
  })

  it('returns default model when no preferences set', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
      publicMetadata: {},
    })
    const result = await getAIConfig('research')
    expect(result.modelId).toBe('claude-sonnet-4-6')
  })

  it('ignores publicMetadata.aiModels (field retired in Phase 2.5)', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
      publicMetadata: { aiModels: { research: 'claude-haiku-4-5-20241022' } },
    })
    const result = await getAIConfig('research')
    expect(result.modelId).toBe('claude-sonnet-4-6')
  })

  it('returns anthropic provider for tool access', async () => {
    setupClerkMocks({
      isAuthenticated: true,
      privateMetadata: { anthropicApiKey: 'sk-ant-test' },
    })
    const result = await getAIConfig('research')
    expect(result.anthropic).toBeDefined()
    expect(mockCreateAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' })
  })
})
