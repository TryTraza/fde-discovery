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
import { sessionsService } from '@/modules/sessions/services/sessions-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

describe('sessionsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listForClient GETs /api/sessions with clientId', async () => {
    mockGet.mockResolvedValue([])
    await sessionsService.listForClient('c1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions', { clientId: 'c1' })
  })

  it('listForClient passes processId when filtering', async () => {
    mockGet.mockResolvedValue([])
    await sessionsService.listForClient('c1', 'p1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions', { clientId: 'c1', processId: 'p1' })
  })

  it('getById GETs /api/sessions/:id', async () => {
    mockGet.mockResolvedValue({})
    await sessionsService.getById('s1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1')
  })

  it('create POSTs /api/sessions', async () => {
    mockPost.mockResolvedValue({})
    await sessionsService.create({ processId: 'p1', type: 'discovery' })
    expect(mockPost).toHaveBeenCalledWith('/api/sessions', {
      processId: 'p1',
      type: 'discovery',
    })
  })

  it('update PATCHes /api/sessions/:id', async () => {
    mockPatch.mockResolvedValue({})
    await sessionsService.update('s1', { transcriptText: 'hello' })
    expect(mockPatch).toHaveBeenCalledWith('/api/sessions/s1', { transcriptText: 'hello' })
  })

  it('delete DELETEs /api/sessions/:id', async () => {
    mockDelete.mockResolvedValue(null)
    await sessionsService.delete('s1')
    expect(mockDelete).toHaveBeenCalledWith('/api/sessions/s1')
  })

  it('synthesize POSTs /api/sessions/:id/synthesize', async () => {
    mockPost.mockResolvedValue({})
    await sessionsService.synthesize('s1')
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/synthesize')
  })

  it('applySynthesis POSTs /api/sessions/:id/apply-synthesis with targetProcessId', async () => {
    mockPost.mockResolvedValue({})
    await sessionsService.applySynthesis('s1', {
      targetProcessId: 'p1',
      applySteps: true,
      applyEdgeCases: false,
    })
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/apply-synthesis', {
      targetProcessId: 'p1',
      applySteps: true,
      applyEdgeCases: false,
      applySystems: true,
      applyQuestions: true,
    })
  })

  it('generatePrepBrief POSTs /api/sessions/:id/prep-brief', async () => {
    mockPost.mockResolvedValue({})
    await sessionsService.generatePrepBrief('s1')
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/prep-brief')
  })

  it('interview POSTs /api/sessions/interview', async () => {
    mockPost.mockResolvedValue({})
    await sessionsService.interview({ processId: 'p1', stage: 'initial' })
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/interview', {
      processId: 'p1',
      stage: 'initial',
    })
  })

  it('listEvents GETs /api/sessions/:id/events', async () => {
    mockGet.mockResolvedValue([])
    await sessionsService.listEvents('s1')
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/s1/events')
  })
})
