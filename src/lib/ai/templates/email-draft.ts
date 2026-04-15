import { renderTemplate } from './render'

export interface EmailDraftTemplateInput {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
}

function formatContacts(contacts: EmailDraftTemplateInput['contacts']): string {
  return contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')
}

function numberedList(items: string[]): string {
  return items.map((q, i) => `${i + 1}. ${q}`).join('\n')
}

/**
 * Renders the user prompt for the email-draft feature.
 *
 * Matches the Langfuse `email-draft` prompt body so callers can swap the
 * prompt-fetch path for this function with no output change.
 */
export function renderEmailDraftTemplate(input: EmailDraftTemplateInput): string {
  return renderTemplate([
    {
      body: `Client: ${input.clientName}
Process: ${input.processName}
Contacts: ${formatContacts(input.contacts)}`,
    },
    {
      heading: 'Session highlights',
      body: input.synthesisHighlights,
    },
    {
      when: input.openQuestions.length > 0,
      heading: 'Open questions to address',
      body: () => numberedList(input.openQuestions),
    },
    {
      body: 'Draft a warm, concise follow-up email (3 paragraphs max + numbered question list). Thank them for their time, summarize key takeaways, list open questions, and propose a clear next step. Respond with the email body only (no subject line, no signature).',
    },
  ])
}
