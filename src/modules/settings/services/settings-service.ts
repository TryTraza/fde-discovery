import { apiClient } from '@/lib/api-client'

export interface SettingsData {
  hasApiKey: boolean
  aiModels: Record<string, string>
}

class SettingsService {
  async get(): Promise<SettingsData> {
    return apiClient.get<SettingsData>('/api/settings')
  }

  async updateApiKey(anthropicApiKey: string): Promise<unknown> {
    return apiClient.patch('/api/settings', { anthropicApiKey })
  }

  async updateAiModels(aiModels: Record<string, string>): Promise<unknown> {
    return apiClient.patch('/api/settings', { aiModels })
  }

  async testKey(): Promise<unknown> {
    return apiClient.post('/api/settings/test-key')
  }
}

export const settingsService = new SettingsService()
