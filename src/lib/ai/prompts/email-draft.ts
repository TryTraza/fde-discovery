import 'server-only'
import { generateText } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { renderEmailDraftTemplate } from '@/lib/ai/templates/email-draft'

const EMAIL_DRAFT_MAX_TOKENS = 1000

interface EmailDraftInput {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
  language: 'en' | 'es'
}

function languageInstruction(language: EmailDraftInput['language']): string {
  return language === 'es'
    ? 'Write the email entirely in Spanish (formal business Spanish).'
    : 'Write the email in English.'
}

export async function generateFollowUpEmail(input: EmailDraftInput): Promise<string> {
  const { model } = await getAIConfig('research')

  const { text } = await generateText({
    model,
    maxOutputTokens: EMAIL_DRAFT_MAX_TOKENS,
    system: `You are a Forward Deployed Engineer drafting a professional follow-up email to a client contact after a discovery session. ${languageInstruction(input.language)}`,
    prompt: renderEmailDraftTemplate({
      clientName: input.clientName,
      processName: input.processName,
      contacts: input.contacts,
      synthesisHighlights: input.synthesisHighlights,
      openQuestions: input.openQuestions,
    }),
  })

  return text
}
