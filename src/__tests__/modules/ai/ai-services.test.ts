import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}))

import { apiClient } from '@/lib/api-client'
import { skillsService } from '@/modules/ai/services/skills-service'
import { aiAgentsService } from '@/modules/ai/services/ai-agents-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>

describe('skillsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list GETs /api/settings/skills', async () => {
    mockGet.mockResolvedValue([])
    await skillsService.list()
    expect(mockGet).toHaveBeenCalledWith('/api/settings/skills')
  })
})

describe('aiAgentsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list GETs /api/settings/ai-agents', async () => {
    mockGet.mockResolvedValue([])
    await aiAgentsService.list()
    expect(mockGet).toHaveBeenCalledWith('/api/settings/ai-agents')
  })

  it('listRegistries GETs /api/settings/registries', async () => {
    mockGet.mockResolvedValue([])
    await aiAgentsService.listRegistries()
    expect(mockGet).toHaveBeenCalledWith('/api/settings/registries')
  })
})
