import { renderTemplate } from './render'

export interface SessionSynthesisTemplateInput {
  clientSection: string
  processSection: string
  processModelSection: string
  contactsSection: string
  priorSessionsSection: string
  sessionTranscript: string
  sessionNotes: string
  sessionInterviewAnswers: string
}

/**
 * User-message body for session-synthesis (non-shadowing). Pure context:
 * client / process / model / contacts / prior sessions, plus the
 * transcript, notes, and interview answers from the current session.
 *
 * Persona, change-type rules, and field-name conventions live in
 * systemPrompt on the feature config.
 */
export function renderSessionSynthesisTemplate(input: SessionSynthesisTemplateInput): string {
  return renderTemplate([
    { body: input.clientSection },
    { body: input.processSection },
    { body: input.processModelSection },
    { body: input.contactsSection },
    { body: input.priorSessionsSection },
    {
      heading: 'Session transcript',
      body: input.sessionTranscript.trim() || 'No transcript provided.',
    },
    {
      when: !!input.sessionNotes.trim(),
      heading: 'FDE personal notes',
      body: input.sessionNotes,
    },
    {
      when: !!input.sessionInterviewAnswers.trim(),
      heading: 'Interview answers',
      body: input.sessionInterviewAnswers,
    },
  ])
}
