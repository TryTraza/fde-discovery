import { renderTemplate } from './render'

export interface ShadowingSynthesisTemplateInput {
  clientSection: string
  processSection: string
  processModelSection: string
  sessionEventsSection: string
  debriefSection: string
  sessionTranscript: string
  sessionNotes: string
  sessionInterviewAnswers: string
}

/**
 * User-message body for shadowing-synthesis. Pure context: client +
 * process + model, then the chronological event log + debrief items
 * from the shadowing run, plus optional transcript / notes / interview.
 */
export function renderShadowingSynthesisTemplate(
  input: ShadowingSynthesisTemplateInput
): string {
  return renderTemplate([
    { body: input.clientSection },
    { body: input.processSection },
    { body: input.processModelSection },
    {
      heading: 'Chronological event log',
      body: input.sessionEventsSection.trim() || 'No events captured.',
    },
    {
      when: !!input.debriefSection.trim(),
      heading: 'Debrief answers',
      body: input.debriefSection,
    },
    {
      when: !!input.sessionTranscript.trim(),
      heading: 'Transcript',
      body: input.sessionTranscript,
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
