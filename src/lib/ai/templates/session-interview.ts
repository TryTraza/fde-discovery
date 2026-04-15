import { renderTemplate } from './render'

export interface SessionInterviewTemplateInput {
  clientSection: string
  processSection: string
  processModelSection: string
  contactsSection: string
  previousAnswers: Array<{ question: string; answer: string }>
}

function renderPreviousAnswers(
  answers: SessionInterviewTemplateInput['previousAnswers']
): string {
  if (answers.length === 0) return 'This is the first question — no previous answers yet.'
  return answers.map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`).join('\n\n')
}

/**
 * Renders the user-message body for the session-interview worker.
 *
 * Pure context. The layer-resolved strings (clientSection, processSection,
 * processModelSection, contactsSection) come from buildAIInput; the caller
 * passes them through as-is. No persona, no task directives.
 */
export function renderSessionInterviewTemplate(input: SessionInterviewTemplateInput): string {
  return renderTemplate([
    { body: input.clientSection },
    { body: input.processSection },
    { body: input.processModelSection },
    { body: input.contactsSection },
    {
      heading: 'Previous answers',
      body: () => renderPreviousAnswers(input.previousAnswers),
    },
  ])
}
