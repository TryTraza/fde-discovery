import { apiClient } from '@/lib/api-client'
import type { Session, Process } from '@/lib/db/schema'
import type { Contact } from '@/lib/db/schema'

export type SessionRecord = Session & {
  contacts?: Contact[]
  linkedProcesses?: Process[]
}

export type SessionCreateInput = Record<string, unknown>

export type SessionUpdateInput = Partial<{
  title: string | null
  status: string
  transcriptText: string | null
  notes: string | null
  durationMinutes: number | null
  scheduledAt: string | null
  prepBriefText: string | null
  questionsAsked: boolean[] | null
  interviewAnswers: { questions: { question: string; answer: string }[] } | null
}>

export type ApplySynthesisPayload = {
  targetProcessId: string
  applySteps?: boolean
  applyEdgeCases?: boolean
  applySystems?: boolean
  applyQuestions?: boolean
}

class SessionsService {
  async listForClient(clientId: string, processId?: string): Promise<SessionRecord[]> {
    return apiClient.get<SessionRecord[]>('/api/sessions', {
      clientId,
      ...(processId ? { processId } : {}),
    })
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

  async applySynthesis(sessionId: string, payload: ApplySynthesisPayload): Promise<unknown> {
    return apiClient.post(`/api/sessions/${sessionId}/apply-synthesis`, {
      targetProcessId: payload.targetProcessId,
      applySteps: payload.applySteps ?? true,
      applyEdgeCases: payload.applyEdgeCases ?? true,
      applySystems: payload.applySystems ?? true,
      applyQuestions: payload.applyQuestions ?? true,
    })
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
