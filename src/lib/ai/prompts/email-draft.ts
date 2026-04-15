import 'server-only'
import { generateText } from 'ai'
import { getAIConfig } from '@/lib/ai/get-ai-config'

interface EmailDraftInput {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
  language: 'en' | 'es'
}

export async function generateFollowUpEmail(input: EmailDraftInput): Promise<string> {
  const { model } = await getAIConfig('research')

  const languageInstruction =
    input.language === 'es'
      ? 'Write the email entirely in Spanish (formal business Spanish).'
      : 'Write the email in English.'

  const { text } = await generateText({
    model,
    maxOutputTokens: 1000,
    system: `You are a Forward Deployed Engineer drafting a professional follow-up email to a client contact after a discovery session. ${languageInstruction}`,
    prompt: `Client: ${input.clientName}
Process: ${input.processName}
Contacts: ${input.contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')}

Session highlights:
${input.synthesisHighlights}

Open questions to address:
${input.openQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Draft a warm, concise follow-up email (3 paragraphs max + numbered question list). Thank them for their time, summarize key takeaways, list open questions, and propose a clear next step. Respond with the email body only (no subject line, no signature).`,
  })

  return text
}
