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
import { clientResearchService } from '@/modules/clients/services/client-research-service'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>

describe('clientResearchService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('get', () => {
    it('GETs /api/clients/:id/research', async () => {
      mockGet.mockResolvedValue(null)
      await clientResearchService.get('c1')
      expect(mockGet).toHaveBeenCalledWith('/api/clients/c1/research')
    })

    it('returns null when no research row exists', async () => {
      mockGet.mockResolvedValue(null)
      const res = await clientResearchService.get('c1')
      expect(res).toBeNull()
    })

    it('returns the row when present', async () => {
      const row = { clientId: 'c1', schemaVersion: 1 }
      mockGet.mockResolvedValue(row)
      const res = await clientResearchService.get('c1')
      expect(res).toEqual(row)
    })
  })

  describe('generate', () => {
    it('POSTs to /api/clients/:id/research', async () => {
      mockPost.mockResolvedValue({ clientId: 'c1', schemaVersion: 1 })
      await clientResearchService.generate('c1')
      expect(mockPost).toHaveBeenCalledWith('/api/clients/c1/research')
    })

    it('returns the persisted research row', async () => {
      const row = { clientId: 'c1', schemaVersion: 1, fitScore: 8 }
      mockPost.mockResolvedValue(row)
      const res = await clientResearchService.generate('c1')
      expect(res).toEqual(row)
    })
  })
})
