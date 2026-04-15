import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { eventsService } from '@/modules/capture/services/events-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

describe('eventsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listForSession GETs /api/sessions/:id/events', async () => {
    mockGet.mockResolvedValue([])
    await eventsService.listForSession('s1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/events')
  })

  it('batchSync POSTs /api/sessions/:id/events/batch with events array', async () => {
    mockPost.mockResolvedValue({ events: [{ id: 'srv-1' }] })
    const evts = [
      {
        sessionId: 's1',
        timestamp: '2026-04-01T00:00:00Z',
        type: 'STEP',
        label: 'Open inbox',
        detail: null,
        suggestionUsed: false,
      },
    ]
    const res = await eventsService.batchSync('s1', evts)
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/events/batch', {
      events: evts,
    })
    expect(res).toEqual({ events: [{ id: 'srv-1' }] })
  })

  it('updateField PATCHes /api/sessions/:id/events/:eventId', async () => {
    mockPatch.mockResolvedValue({})
    await eventsService.updateField('s1', 'e1', { label: 'updated' })
    expect(mockPatch).toHaveBeenCalledWith('/api/sessions/s1/events/e1', { label: 'updated' })
  })

  it('delete DELETEs /api/sessions/:id/events/:eventId', async () => {
    mockDelete.mockResolvedValue(null)
    await eventsService.delete('s1', 'e1')
    expect(mockDelete).toHaveBeenCalledWith('/api/sessions/s1/events/e1')
  })
})
