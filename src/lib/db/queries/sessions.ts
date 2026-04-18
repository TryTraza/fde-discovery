import { eq, and, isNull, desc, inArray, or } from 'drizzle-orm'
import { db } from '../index'
import {
  sessions,
  sessionContacts,
  sessionProcessLinks,
  processes,
  contacts,
  eventLogs,
  type Session,
  type SessionStatus,
  type NewSession,
  type Contact,
  type Process,
} from '../schema'
import { getProcessWithFullContext } from './processes'

const notDeleted = isNull(sessions.deletedAt)

async function buildSessionsFilterForProcess(processId: string) {
  const linkedRows = await db
    .select({ sessionId: sessionProcessLinks.sessionId })
    .from(sessionProcessLinks)
    .where(eq(sessionProcessLinks.processId, processId))
  const linkedIds = linkedRows.map((r) => r.sessionId)
  if (linkedIds.length === 0) {
    return eq(sessions.processId, processId)
  }
  return or(eq(sessions.processId, processId), inArray(sessions.id, linkedIds))
}

export async function createSession(data: NewSession) {
  const [session] = await db.insert(sessions).values(data).returning()
  return session
}

export async function createSessionContacts(
  sessionId: string,
  contactIds: string[],
  roles: Record<string, string>
) {
  if (contactIds.length === 0) return
  const values = contactIds.map((contactId) => ({
    sessionId,
    contactId,
    roleInSession: roles[contactId] ?? null,
  }))
  await db.insert(sessionContacts).values(values)
}

export async function linkSessionToProcess(sessionId: string, processId: string) {
  try {
    await db.insert(sessionProcessLinks).values({ sessionId, processId })
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: string }).code : ''
    if (code === '23505') return
    throw e
  }
}

export async function unlinkSessionFromProcess(sessionId: string, processId: string) {
  await db
    .delete(sessionProcessLinks)
    .where(
      and(eq(sessionProcessLinks.sessionId, sessionId), eq(sessionProcessLinks.processId, processId))
    )
}

export async function getLinkedProcessIds(sessionId: string): Promise<string[]> {
  const rows = await db
    .select({ processId: sessionProcessLinks.processId })
    .from(sessionProcessLinks)
    .where(eq(sessionProcessLinks.sessionId, sessionId))
  return rows.map((r) => r.processId)
}

export async function getLinkedProcesses(sessionId: string): Promise<Process[]> {
  const rows = await db
    .select({ process: processes })
    .from(sessionProcessLinks)
    .innerJoin(processes, eq(sessionProcessLinks.processId, processes.id))
    .where(and(eq(sessionProcessLinks.sessionId, sessionId), isNull(processes.deletedAt)))
  return rows.map((r) => r.process)
}

export async function getPrimaryProcessIdForSession(session: Session): Promise<string | null> {
  if (session.processId) return session.processId
  const [row] = await db
    .select({ processId: sessionProcessLinks.processId })
    .from(sessionProcessLinks)
    .where(eq(sessionProcessLinks.sessionId, session.id))
    .limit(1)
  return row?.processId ?? null
}

export async function getPrimaryProcessIdForSessionId(sessionId: string): Promise<string | null> {
  const session = await getSessionById(sessionId)
  if (!session) return null
  return getPrimaryProcessIdForSession(session)
}

export async function listSessionsByProcess(processId: string) {
  const cond = await buildSessionsFilterForProcess(processId)
  return db
    .select()
    .from(sessions)
    .where(and(cond, notDeleted))
    .orderBy(desc(sessions.date))
}

export async function listSessionsByClient(clientId: string, processIdFilter?: string) {
  const base = and(eq(sessions.clientId, clientId), notDeleted)
  if (!processIdFilter) {
    return db
      .select()
      .from(sessions)
      .where(base)
      .orderBy(desc(sessions.date))
  }
  const cond = await buildSessionsFilterForProcess(processIdFilter)
  return db
    .select()
    .from(sessions)
    .where(and(base, cond))
    .orderBy(desc(sessions.date))
}

export async function listSessionContacts(sessionId: string): Promise<Contact[]> {
  const rows = await db
    .select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(and(eq(sessionContacts.sessionId, sessionId), isNull(contacts.deletedAt)))
  return rows.map((r) => r.contact)
}

export async function removeSessionContact(sessionId: string, contactId: string) {
  await db
    .delete(sessionContacts)
    .where(and(eq(sessionContacts.sessionId, sessionId), eq(sessionContacts.contactId, contactId)))
}

export async function getSessionById(id: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), notDeleted))
  return session ?? null
}

export async function getSessionWithFullContext(id: string) {
  const session = await getSessionById(id)
  if (!session) return null

  const events = await db
    .select()
    .from(eventLogs)
    .where(eq(eventLogs.sessionId, id))
    .orderBy(eventLogs.timestamp)

  const primaryProcessId = await getPrimaryProcessIdForSession(session)
  const process = primaryProcessId ? await getProcessWithFullContext(primaryProcessId) : null

  return { ...session, eventLogs: events, process }
}

export async function updateSession(id: string, data: Partial<NewSession>) {
  const [updated] = await db
    .update(sessions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sessions.id, id), notDeleted))
    .returning()
  return updated ?? null
}

export async function softDeleteSession(id: string) {
  const [deleted] = await db
    .update(sessions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sessions.id, id), notDeleted))
    .returning()
  return deleted ?? null
}

export async function getSessionWithContacts(id: string) {
  const session = await getSessionById(id)
  if (!session) return null

  const contactRows = await db
    .select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(and(eq(sessionContacts.sessionId, id), isNull(contacts.deletedAt)))

  return {
    ...session,
    contacts: contactRows.map((r) => r.contact),
  }
}

export async function getCompletedSessionsByProcess(processId: string) {
  const cond = await buildSessionsFilterForProcess(processId)
  return db
    .select()
    .from(sessions)
    .where(
      and(
        cond,
        inArray(sessions.status, ['completed', 'synthesis_done'] satisfies SessionStatus[]),
        notDeleted
      )
    )
    .orderBy(sessions.date)
}

export async function sessionIsLinkedToProcess(
  sessionId: string,
  processId: string
): Promise<boolean> {
  const session = await getSessionById(sessionId)
  if (!session) return false
  if (session.processId === processId) return true
  const [row] = await db
    .select({ id: sessionProcessLinks.id })
    .from(sessionProcessLinks)
    .where(
      and(
        eq(sessionProcessLinks.sessionId, sessionId),
        eq(sessionProcessLinks.processId, processId)
      )
    )
    .limit(1)
  return Boolean(row)
}

export async function countProcessLinksForSession(sessionId: string): Promise<number> {
  const ids = await getLinkedProcessIds(sessionId)
  return ids.length
}
