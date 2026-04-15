// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn().mockReturnValue('step-count-stop'),
}))

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(),
}))

vi.mock('@/lib/db/queries/clients', () => ({
  updateClient: vi.fn(),
}))

import { triggerCompanyResearch } from '@/lib/ai/prompts/company-research'
import { generateText } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { updateClient } from '@/lib/db/queries/clients'

describe('triggerCompanyResearch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls generateText with web search tool and updates aiSummary on success', async () => {
    const mockModel = 'mock-model'
    const mockAnthropic = {
      tools: { webSearch_20250305: vi.fn().mockReturnValue('web-search-tool') },
    }
    vi.mocked(getAIConfig).mockResolvedValue({
      model: mockModel as any,
      modelId: 'claude-sonnet-4-20250514',
      anthropic: mockAnthropic as any,
    })
    vi.mocked(generateText).mockResolvedValue({ text: 'Research result about Acme Corp' } as any)

    await triggerCompanyResearch('client-1', 'Acme Corp', 'Tech', 'https://acme.com')

    expect(generateText).toHaveBeenCalledOnce()
    expect(updateClient).toHaveBeenCalledWith('client-1', {
      aiSummary: expect.stringContaining('Research result'),
    })
  })

  it('sets friendly message when no API key (NO_API_KEY)', async () => {
    vi.mocked(getAIConfig).mockRejectedValue(new Error('NO_API_KEY'))

    await triggerCompanyResearch('client-1', 'Acme Corp', 'Tech')

    expect(generateText).not.toHaveBeenCalled()
    expect(updateClient).toHaveBeenCalledWith('client-1', {
      aiSummary: expect.stringContaining('Settings'),
    })
  })

  it('sets fallback message on generic errors', async () => {
    const mockModel = 'mock-model'
    const mockAnthropic = {
      tools: { webSearch_20250305: vi.fn().mockReturnValue('web-search-tool') },
    }
    vi.mocked(getAIConfig).mockResolvedValue({
      model: mockModel as any,
      modelId: 'claude-sonnet-4-20250514',
      anthropic: mockAnthropic as any,
    })
    vi.mocked(generateText).mockRejectedValue(new Error('API rate limit'))

    await triggerCompanyResearch('client-1', 'Acme Corp', 'Tech')

    expect(updateClient).toHaveBeenCalledWith('client-1', {
      aiSummary: expect.stringContaining('research'),
    })
  })
})
