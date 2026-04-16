import { renderTemplate } from './render'

export interface CaptureSuggestionsTemplateInput {
  domainKnowledge: string
  processModelSection: string
  sessionEventsSection: string
}

/**
 * User-message body for capture-suggestions. Pure context — the task
 * ("suggest 3-5 next steps") lives in systemPrompt.
 */
export function renderCaptureSuggestionsTemplate(
  input: CaptureSuggestionsTemplateInput
): string {
  return renderTemplate([
    { body: input.domainKnowledge },
    { body: input.processModelSection },
    {
      heading: 'Recent capture events',
      body: input.sessionEventsSection.trim() || 'No events yet.',
    },
  ])
}
