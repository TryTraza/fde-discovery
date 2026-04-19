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
import { clientsService } from '@/modules/clients/services/clients-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>

describe('clientsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('GETs /api/clients with no params when no filters', async () => {
      mockGet.mockResolvedValue([])
      await clientsService.list()
      expect(mockGet).toHaveBeenCalledWith('/api/clients', {})
    })

    it('passes filters as query params', async () => {
      mockGet.mockResolvedValue([])
      await clientsService.list({ search: 'acme', status: 'active_poc', industry: 'fintech' })
      expect(mockGet).toHaveBeenCalledWith('/api/clients', {
        search: 'acme',
        status: 'active_poc',
        industry: 'fintech',
      })
    })
  })

  describe('getById', () => {
    it('GETs /api/clients/:id', async () => {
      mockGet.mockResolvedValue({ id: '1', name: 'Acme' })
      const result = await clientsService.getById('1')
      expect(mockGet).toHaveBeenCalledWith('/api/clients/1')
      expect(result).toEqual({ id: '1', name: 'Acme' })
    })
  })

  describe('create', () => {
    it('POSTs to /api/clients with the payload', async () => {
      mockPost.mockResolvedValue({ id: '1' })
      await clientsService.create({ name: 'Acme', industry: 'fintech' })
      expect(mockPost).toHaveBeenCalledWith('/api/clients', {
        name: 'Acme',
        industry: 'fintech',
      })
    })
  })

  describe('update', () => {
    it('PATCHes /api/clients/:id with the payload', async () => {
      mockPatch.mockResolvedValue({ id: '1' })
      await clientsService.update('1', { name: 'New Name' })
      expect(mockPatch).toHaveBeenCalledWith('/api/clients/1', { name: 'New Name' })
    })
  })

  describe('delete', () => {
    it('DELETEs /api/clients/:id', async () => {
      mockDelete.mockResolvedValue(null)
      await clientsService.delete('1')
      expect(mockDelete).toHaveBeenCalledWith('/api/clients/1')
    })
  })

})
