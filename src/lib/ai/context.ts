import 'server-only'
import {
  getSessionById,
  listSessionContacts,
  getCompletedSessionsByProcess,
  getPrimaryProcessIdForSession,
} from '@/lib/db/queries/sessions'
import { getProcessWithModel } from '@/lib/db/queries/processes'
import { getClientById } from '@/lib/db/queries/clients'
import { getResearchByClientId } from '@/lib/db/queries/client-research'
import { getEventsBySessionId } from '@/lib/db/queries/events'
import type { DebriefAnswers } from '@/lib/db/types'

export interface SessionContext {
  client: {
    id: string
    name: string
    industry: string
    website: string | null
    status: string
    companyOverview: string | null
    notes: string | null
  }
  process: {
    id: string
    name: string
    description: string | null
    status: string
    hypothesisText: string | null
    departmentTag: string | null
    processTypeL1: string | null
    model: { steps: any[]; systems: any[]; edgeCases: any[] } | null
  }
  session: {
    id: string
    type: string
    title: string
    date: string
    status: string
    interviewAnswers: any
    transcriptText: string | null
    notes: string | null
  }
  sessionContacts: Array<{
    id: string
    name: string
    role: string | null
    department: string | null
  }>
  priorSessions: Array<{
    id: string
    type: string
    title: string
    date: string
    status: string
    interviewAnswers: any
    synthesisOutput: any
    transcriptText: string | null
    notes: string | null
  }>
  // Shadowing-specific fields
  events?: Array<{
    type: string
    label: string | null
    detail: string | null
    timestamp: string
  }>
  debriefAnswers?: DebriefAnswers | null
  notes?: string | null
}

/**
 * Builds the full L1+L2+L3 context chain for a session.
 * Used by all AI prompts (interview, prep-brief, synthesis) to ensure consistent context.
 */
export async function buildSessionContext(sessionId: string): Promise<SessionContext> {
  const session = await getSessionById(sessionId)
  if (!session) throw new Error('Session not found')

  const client = await getClientById(session.clientId)
  if (!client) throw new Error('Client not found')

  const primaryProcessId = await getPrimaryProcessIdForSession(session)
  const process = primaryProcessId ? await getProcessWithModel(primaryProcessId) : null

  const [contacts, completedSessions, research] = await Promise.all([
    listSessionContacts(sessionId),
    primaryProcessId ? getCompletedSessionsByProcess(primaryProcessId) : Promise.resolve([]),
    getResearchByClientId(client.id),
  ])

  const pm = process?.processModel ?? null

  // For shadowing sessions, load events for synthesis context
  let shadowingFields: Pick<SessionContext, 'events' | 'debriefAnswers' | 'notes'> = {}
  if (session.type === 'shadowing') {
    const events = await getEventsBySessionId(session.id)
    shadowingFields = {
      events: events.map((e) => ({
        type: e.type,
        label: e.label,
        detail: e.detail,
        timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp),
      })),
      debriefAnswers: session.debriefAnswers as DebriefAnswers | null,
      notes: session.notes ?? null,
    }
  }

  return {
    ...shadowingFields,
    client: {
      id: client.id,
      name: client.name,
      industry: client.industry,
      website: client.website,
      status: client.status,
      companyOverview: research?.companyOverview ?? null,
      notes: client.notes,
    },
    process: {
      id: process?.id ?? '',
      name: process?.name ?? '(No process linked)',
      description: process?.description ?? null,
      status: process?.status ?? 'draft',
      hypothesisText: process?.hypothesisText ?? null,
      departmentTag: process?.departmentTag ?? null,
      processTypeL1: process?.processTypeL1 ?? null,
      model: pm
        ? {
            steps: (pm.steps as any[]) ?? [],
            systems: (pm.systems as any[]) ?? [],
            edgeCases: (pm.edgeCases as any[]) ?? [],
          }
        : null,
    },
    session: {
      id: session.id,
      type: session.type,
      title: session.title,
      date: session.date,
      status: session.status,
      interviewAnswers: session.interviewAnswers,
      transcriptText: session.transcriptText,
      notes: session.notes,
    },
    sessionContacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      department: c.department,
    })),
    priorSessions: completedSessions
      .filter((s) => s.id !== sessionId)
      .map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        date: s.date,
        status: s.status,
        interviewAnswers: s.interviewAnswers,
        synthesisOutput: s.synthesisOutput,
        transcriptText: s.transcriptText,
        notes: s.notes,
      })),
  }
}
