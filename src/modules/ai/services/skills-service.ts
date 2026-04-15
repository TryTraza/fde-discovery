import { apiClient } from '@/lib/api-client'

export interface Skill {
  id: string
  name: string
  description?: string | null
  enabled?: boolean
  [key: string]: unknown
}

class SkillsService {
  async list(): Promise<Skill[]> {
    return apiClient.get<Skill[]>('/api/settings/skills')
  }
}

export const skillsService = new SkillsService()
