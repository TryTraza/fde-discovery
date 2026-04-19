import { apiClient } from '@/lib/api-client'
import type { ClientResearch } from '@/modules/clients/types'

class ClientResearchService {
  private readonly basePath = '/api/clients'

  async get(clientId: string): Promise<ClientResearch | null> {
    return apiClient.get<ClientResearch | null>(`${this.basePath}/${clientId}/research`)
  }

  async generate(clientId: string): Promise<ClientResearch> {
    return apiClient.post<ClientResearch>(`${this.basePath}/${clientId}/research`)
  }
}

export const clientResearchService = new ClientResearchService()
