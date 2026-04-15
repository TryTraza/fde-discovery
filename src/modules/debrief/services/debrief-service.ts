import { apiClient } from '@/lib/api-client'

export interface DebriefItemPayload {
  eventLogId: string
  type: 'question' | 'implicit'
  resolution: string
  answer?: string
  description?: string
  priority?: string
}

class DebriefService {
  async get<T = unknown>(sessionId: string): Promise<T> {
    return apiClient.get<T>(`/api/sessions/${sessionId}/debrief`)
  }

  async save(sessionId: string, payload: { items: DebriefItemPayload[] }): Promise<unknown> {
    return apiClient.post(`/api/sessions/${sessionId}/debrief`, payload)
  }
}

export const debriefService = new DebriefService()
