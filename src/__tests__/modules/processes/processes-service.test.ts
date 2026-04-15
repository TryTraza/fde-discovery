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
import { processesService } from '@/modules/processes/services/processes-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

describe('processesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list GETs /api/clients/:c/processes', async () => {
    mockGet.mockResolvedValue([])
    await processesService.list('c1')
    expect(mockGet).toHaveBeenCalledWith('/api/clients/c1/processes')
  })

  it('getById GETs /api/clients/:c/processes/:p', async () => {
    mockGet.mockResolvedValue({})
    await processesService.getById('c1', 'p1')
    expect(mockGet).toHaveBeenCalledWith('/api/clients/c1/processes/p1')
  })

  it('create POSTs /api/clients/:c/processes', async () => {
    mockPost.mockResolvedValue({ id: 'p1' })
    await processesService.create('c1', { name: 'Invoice' })
    expect(mockPost).toHaveBeenCalledWith('/api/clients/c1/processes', { name: 'Invoice' })
  })

  it('update PATCHes /api/clients/:c/processes/:p', async () => {
    mockPatch.mockResolvedValue({})
    await processesService.update('c1', 'p1', { name: 'X' })
    expect(mockPatch).toHaveBeenCalledWith('/api/clients/c1/processes/p1', { name: 'X' })
  })

  it('delete DELETEs /api/clients/:c/processes/:p', async () => {
    mockDelete.mockResolvedValue(null)
    await processesService.delete('c1', 'p1')
    expect(mockDelete).toHaveBeenCalledWith('/api/clients/c1/processes/p1')
  })

  it('regenerateHypothesis POSTs the hypothesis endpoint', async () => {
    mockPost.mockResolvedValue({})
    await processesService.regenerateHypothesis('c1', 'p1')
    expect(mockPost).toHaveBeenCalledWith(
      '/api/clients/c1/processes/p1/hypothesis'
    )
  })

  it('updateSteps PATCHes /api/clients/:c/processes/:p/steps', async () => {
    mockPatch.mockResolvedValue({})
    const steps = [{ id: 's1', name: 'a', order: 1 }]
    await processesService.updateSteps('c1', 'p1', steps)
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/clients/c1/processes/p1/steps',
      { steps }
    )
  })
})
