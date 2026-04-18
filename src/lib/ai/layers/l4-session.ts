import {
  getSessionById,
  listSessionContacts,
  getCompletedSessionsByProcess,
  getPrimaryProcessIdForSession,
} from '@/lib/db/queries/sessions'
import { getEventsBySessionId } from '@/lib/db/queries/events'
import {
  EMPTY_LAYER_RESULT,
  type ContextLayer,
  type LayerParams,
  type LayerResult,
  type L4Options,
} from './types'

export const l4SessionLayer: ContextLayer<L4Options> = {
  name: 'l4-session',

  async resolve(params: LayerParams, options?: L4Options): Promise<LayerResult> {
    if (!params.sessionId) {
      console.warn('[AI] L4 session layer: no sessionId provided, returning empty.')
      return EMPTY_LAYER_RESULT
    }

    const session = await getSessionById(params.sessionId)
    if (!session) return EMPTY_LAYER_RESULT

    const primaryProcessId = await getPrimaryProcessIdForSession(session)

    const eventsMode = options?.events ?? 'none'
    const includeContacts = options?.contacts ?? false
    const includePrior = options?.priorSessions ?? false
    const includeDebrief = options?.debrief ?? false

    const [events, contacts, priorSessions] = await Promise.all([
      eventsMode !== 'none' ? getEventsBySessionId(params.sessionId) : Promise.resolve([]),
      includeContacts ? listSessionContacts(params.sessionId) : Promise.resolve([]),
      includePrior && primaryProcessId
        ? getCompletedSessionsByProcess(primaryProcessId)
        : Promise.resolve([]),
    ])

    // Pre-render events section
    let sessionEventsSection = ''
    if (eventsMode !== 'none' && events.length > 0) {
      const eventsToRender = eventsMode === 'last20' ? events.slice(-20) : events
      sessionEventsSection = eventsToRender
        .map(
          (e: any) => `- ${e.type}: ${e.label ?? '(no label)'}${e.detail ? ` (${e.detail})` : ''}`
        )
        .join('\n')
    }

    // Pre-render contacts section
    let contactsSection = ''
    if (includeContacts && contacts.length > 0) {
      contactsSection =
        '## Session Contacts\n' +
        contacts
          .map(
            (c: any) =>
              `- **${c.name}**${c.role ? ` — ${c.role}` : ''}${c.department ? ` (${c.department})` : ''}`
          )
          .join('\n')
    }

    // Pre-render prior sessions section (exclude current session)
    let priorSessionsSection = ''
    if (includePrior && priorSessions.length > 0) {
      const filtered = priorSessions.filter((s: any) => s.id !== params.sessionId)
      if (filtered.length > 0) {
        priorSessionsSection =
          '## Prior Sessions\n' +
          filtered
            .map((s: any) => {
              const parts = [`- **${s.title}** (${s.type}, ${s.status})`]
              if (s.transcriptText) parts.push(`  Transcript: ${s.transcriptText.slice(0, 200)}...`)
              if (s.notes) parts.push(`  Notes: ${s.notes.slice(0, 200)}...`)
              return parts.join('\n')
            })
            .join('\n')
      }
    }

    // Pre-render debrief section
    let debriefSection = ''
    if (includeDebrief && session.debriefAnswers) {
      const answers = session.debriefAnswers as unknown as Record<string, unknown>
      debriefSection = '## Debrief Answers\n' + JSON.stringify(answers, null, 2)
    }

    const vars: Record<string, string> = {
      sessionEventsSection,
      contactsSection,
      priorSessionsSection,
      debriefSection,
      sessionTranscript: session.transcriptText ?? '',
      sessionNotes: session.notes ?? '',
      sessionType: session.type,
      sessionTitle: session.title,
      sessionStatus: session.status ?? '',
      sessionInterviewAnswers: session.interviewAnswers
        ? JSON.stringify(session.interviewAnswers, null, 2)
        : '',
    }

    return {
      data: { session, events, contacts, priorSessions },
      templateVars: vars,
    }
  },
}
