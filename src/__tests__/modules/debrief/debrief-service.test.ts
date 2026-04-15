import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { debriefService } from '@/modules/debrief/services/debrief-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>

describe('debriefService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('get GETs /api/sessions/:id/debrief', async () => {
    mockGet.mockResolvedValue({})
    await debriefService.get('s1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/debrief')
  })

  it('save POSTs /api/sessions/:id/debrief with items payload', async () => {
    mockPost.mockResolvedValue({})
    const items = [
      {
        eventLogId: 'e1',
        type: 'question' as const,
        resolution: 'answered',
        answer: 'yes',
      },
    ]
    await debriefService.save('s1', { items })
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/debrief', { items })
  })
})
