import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

import { apiClient } from '@/lib/api-client'
import { settingsService } from '@/modules/settings/services/settings-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>

describe('settingsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('get GETs /api/settings', async () => {
    mockGet.mockResolvedValue({})
    await settingsService.get()
    expect(mockGet).toHaveBeenCalledWith('/api/settings')
  })

  it('updateApiKey PATCHes /api/settings with anthropicApiKey', async () => {
    mockPatch.mockResolvedValue({})
    await settingsService.updateApiKey('sk-ant-xyz')
    expect(mockPatch).toHaveBeenCalledWith('/api/settings', { anthropicApiKey: 'sk-ant-xyz' })
  })

  it('updateAiModels PATCHes /api/settings with aiModels object', async () => {
    mockPatch.mockResolvedValue({})
    await settingsService.updateAiModels({ research: 'claude-sonnet-4' })
    expect(mockPatch).toHaveBeenCalledWith('/api/settings', {
      aiModels: { research: 'claude-sonnet-4' },
    })
  })

  it('testKey POSTs /api/settings/test-key', async () => {
    mockPost.mockResolvedValue({})
    await settingsService.testKey()
    expect(mockPost).toHaveBeenCalledWith('/api/settings/test-key')
  })
})
