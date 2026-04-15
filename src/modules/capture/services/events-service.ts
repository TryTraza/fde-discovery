import { apiClient } from '@/lib/api-client'

export interface EventPayload {
  sessionId: string
  timestamp: string
  type: string
  label: string | null
  detail: string | null
  suggestionUsed: boolean
}

export interface BatchSyncResponse {
  events: Array<{ id: string }>
}

class EventsService {
  async listForSession<T = unknown>(sessionId: string): Promise<T[]> {
    return apiClient.get<T[]>(`/api/sessions/${sessionId}/events`)
  }

  async batchSync(sessionId: string, events: EventPayload[]): Promise<BatchSyncResponse> {
    return apiClient.post<BatchSyncResponse>(`/api/sessions/${sessionId}/events/batch`, { events })
  }

  async updateField(
    sessionId: string,
    eventId: string,
    patch: Partial<{ label: string; detail: string }>
  ): Promise<unknown> {
    return apiClient.patch(`/api/sessions/${sessionId}/events/${eventId}`, patch)
  }

  async delete(sessionId: string, eventId: string): Promise<void> {
    await apiClient.delete(`/api/sessions/${sessionId}/events/${eventId}`)
  }
}

export const eventsService = new EventsService()
