import { apiClient } from '@/lib/api-client'
import type {
  Client,
  ClientCreateInput,
  ClientFilters,
  ClientUpdateInput,
} from '@/modules/clients/types'

class ClientsService {
  private readonly basePath = '/api/clients'

  async list(filters: ClientFilters = {}): Promise<Client[]> {
    return apiClient.get<Client[]>(this.basePath, { ...filters })
  }

  async getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`${this.basePath}/${id}`)
  }

  async create(data: ClientCreateInput): Promise<Client> {
    return apiClient.post<Client>(this.basePath, data)
  }

  async update(id: string, data: ClientUpdateInput): Promise<Client> {
    return apiClient.patch<Client>(`${this.basePath}/${id}`, data)
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`)
  }

  async generateResearch(id: string): Promise<unknown> {
    return apiClient.post(`${this.basePath}/${id}/research`)
  }
}

export const clientsService = new ClientsService()
