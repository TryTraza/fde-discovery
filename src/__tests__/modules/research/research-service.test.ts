import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
  ApiKeyMissingError: class extends Error {
    constructor() {
      super('NO_API_KEY')
      this.name = 'ApiKeyMissingError'
    }
  },
}))

import { apiClient, ApiKeyMissingError } from '@/lib/api-client'
import { researchService } from '@/modules/research/services/research-service'

const mockPost = apiClient.post as ReturnType<typeof vi.fn>

describe('researchService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generateEmailDraft POSTs to /api/sessions/:id/email-draft with language', async () => {
    mockPost.mockResolvedValue({ email: 'Hi' })
    const res = await researchService.generateEmailDraft('s1', 'es')
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/email-draft', { language: 'es' })
    expect(res).toEqual({ email: 'Hi' })
  })

  it('generateEmailDraft propagates ApiKeyMissingError', async () => {
    mockPost.mockRejectedValue(new ApiKeyMissingError({}))
    await expect(researchService.generateEmailDraft('s1', 'en')).rejects.toBeInstanceOf(
      ApiKeyMissingError
    )
  })
})
