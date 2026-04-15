import { apiClient } from '@/lib/api-client'

export type EmailDraftLanguage = 'en' | 'es'

class ResearchService {
  async generateEmailDraft(
    sessionId: string,
    language: EmailDraftLanguage
  ): Promise<{ email: string }> {
    return apiClient.post<{ email: string }>(`/api/sessions/${sessionId}/email-draft`, {
      language,
    })
  }
}

export const researchService = new ResearchService()
