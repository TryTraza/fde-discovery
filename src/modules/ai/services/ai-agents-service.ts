import { apiClient } from '@/lib/api-client'

export interface AIAgent {
  id: string
  name: string
  [key: string]: unknown
}

// The /api/settings/registries endpoint returns a free-form object (schemas,
// providers, etc.) — we don't enforce a shape here because the page that
// consumes it still does ad-hoc property access.
export type RegistriesResponse = Record<string, unknown>

class AIAgentsService {
  async list(): Promise<AIAgent[]> {
    return apiClient.get<AIAgent[]>('/api/settings/ai-agents')
  }

  async listRegistries(): Promise<RegistriesResponse> {
    return apiClient.get<RegistriesResponse>('/api/settings/registries')
  }
}

export const aiAgentsService = new AIAgentsService()
