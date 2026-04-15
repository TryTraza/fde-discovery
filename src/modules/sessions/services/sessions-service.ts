import { apiClient } from '@/lib/api-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SessionRecord = any

// Loose shape — the route handler validates via Zod, and the legacy dialog
// sends `type` (not `sessionType`) plus arbitrary date / contactIds fields.
// We don't redefine the contract here.
export type SessionCreateInput = Record<string, unknown>

export type SessionUpdateInput = Partial<{
  title: string | null
  status: string
  transcriptText: string | null
  notes: string | null
  durationMinutes: number | null
  scheduledAt: string | null
  prepBriefText: string | null
}>

class SessionsService {
  async listForProcess(processId: string): Promise<SessionRecord[]> {
    return apiClient.get<SessionRecord[]>('/api/sessions', { processId })
  }

  async getById(sessionId: string): Promise<SessionRecord> {
    return apiClient.get<SessionRecord>(`/api/sessions/${sessionId}`)
  }

  async create(data: SessionCreateInput): Promise<SessionRecord> {
    return apiClient.post<SessionRecord>('/api/sessions', data)
  }

  async update(sessionId: string, data: SessionUpdateInput): Promise<SessionRecord> {
    return apiClient.patch<SessionRecord>(`/api/sessions/${sessionId}`, data)
  }

  async delete(sessionId: string): Promise<void> {
    await apiClient.delete(`/api/sessions/${sessionId}`)
  }

  async synthesize(sessionId: string): Promise<unknown> {
    return apiClient.post(`/api/sessions/${sessionId}/synthesize`)
  }

  async applySynthesis(sessionId: string, sections: Record<string, boolean>): Promise<unknown> {
    return apiClient.post(`/api/sessions/${sessionId}/apply-synthesis`, sections)
  }

  async generatePrepBrief(sessionId: string): Promise<unknown> {
    return apiClient.post(`/api/sessions/${sessionId}/prep-brief`)
  }

  async interview(payload: unknown): Promise<unknown> {
    return apiClient.post('/api/sessions/interview', payload)
  }

  async listEvents(sessionId: string): Promise<unknown[]> {
    return apiClient.get<unknown[]>(`/api/sessions/${sessionId}/events`)
  }
}

export const sessionsService = new SessionsService()
