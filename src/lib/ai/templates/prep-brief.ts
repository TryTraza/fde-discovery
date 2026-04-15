import { renderTemplate } from './render'

export interface PrepBriefTemplateInput {
  clientSection: string
  processSection: string
  processModelSection: string
  contactsSection: string
  priorSessionsSection: string
  sessionInterviewAnswers: string
}

/**
 * User-message body for prep-brief. Pure layer-resolved context.
 * Persona + task live in systemPrompt.
 */
export function renderPrepBriefTemplate(input: PrepBriefTemplateInput): string {
  return renderTemplate([
    { body: input.clientSection },
    { body: input.processSection },
    { body: input.processModelSection },
    { body: input.contactsSection },
    { body: input.priorSessionsSection },
    {
      when: !!input.sessionInterviewAnswers.trim(),
      heading: 'FDE interview answers',
      body: input.sessionInterviewAnswers,
    },
  ])
}
