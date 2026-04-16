import { renderTemplate } from './render'

export interface EmailDraftTemplateInput {
  clientName: string
  processName: string
  contacts: Array<{ name: string; role?: string | null }>
  synthesisHighlights: string
  openQuestions: string[]
  /**
   * Free-form language directive (e.g. "Write the email in English.").
   * The persona rule "respond in the language the user specifies" lives
   * in systemPrompt — this section just tells the worker which language
   * to pick this time.
   */
  languageInstruction: string
}

function formatContacts(contacts: EmailDraftTemplateInput['contacts']): string {
  return contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')
}

function numberedList(items: string[]): string {
  return items.map((q, i) => `${i + 1}. ${q}`).join('\n')
}

/**
 * Renders the user-message body for the email-draft worker.
 *
 * Pure context + light structural markers (H2s, numbered list, bullets).
 * No persona. No task instructions. No output-format rules. Anything
 * that describes WHAT the model should do lives in systemPrompt on the
 * feature config, not here.
 */
export function renderEmailDraftTemplate(input: EmailDraftTemplateInput): string {
  return renderTemplate([
    {
      heading: 'Session',
      body: `- Client: ${input.clientName}
- Process: ${input.processName}
- Contacts: ${formatContacts(input.contacts)}`,
    },
    {
      heading: 'Highlights',
      body: input.synthesisHighlights,
    },
    {
      when: input.openQuestions.length > 0,
      heading: 'Open questions',
      body: () => numberedList(input.openQuestions),
    },
    {
      heading: 'Output language',
      body: input.languageInstruction,
    },
  ])
}
