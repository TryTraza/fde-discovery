import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { db } from '../index';
import { sessions, sessionContacts, contacts, eventLogs, type SessionStatus, type NewSession, type Contact } from '../schema';
import { getProcessWithFullContext } from './processes';

const notDeleted = isNull(sessions.deletedAt);

export async function createSession(data: NewSession) {
  const [session] = await db.insert(sessions).values(data).returning();
  return session;
}

export async function createSessionContacts(
  sessionId: string,
  contactIds: string[],
  roles: Record<string, string>
) {
  if (contactIds.length === 0) return;
  const values = contactIds.map((contactId) => ({
    sessionId,
    contactId,
    roleInSession: roles[contactId] ?? null,
  }));
  await db.insert(sessionContacts).values(values);
}

// v4: FIX #22 — exclude soft-deleted contacts
export async function listSessionContacts(sessionId: string): Promise<Contact[]> {
  const rows = await db.select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(and(
      eq(sessionContacts.sessionId, sessionId),
      isNull(contacts.deletedAt),
    ));
  return rows.map(r => r.contact);
}

export async function removeSessionContact(sessionId: string, contactId: string) {
  await db.delete(sessionContacts).where(
    and(eq(sessionContacts.sessionId, sessionId), eq(sessionContacts.contactId, contactId))
  );
}

export async function listSessionsByProcess(processId: string) {
  return db.select().from(sessions)
    .where(and(eq(sessions.processId, processId), notDeleted))
    .orderBy(desc(sessions.date));
}

export async function getSessionById(id: string) {
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, id), notDeleted));
  return session ?? null;
}

export async function getSessionWithFullContext(id: string) {
  const session = await getSessionById(id);
  if (!session) return null;

  const events = await db.select().from(eventLogs)
    .where(eq(eventLogs.sessionId, id))
    .orderBy(eventLogs.timestamp);

  const process = await getProcessWithFullContext(session.processId);

  return { ...session, eventLogs: events, process };
}

export async function updateSession(id: string, data: Partial<NewSession>) {
  const [updated] = await db.update(sessions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sessions.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function softDeleteSession(id: string) {
  const [deleted] = await db
    .update(sessions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sessions.id, id), notDeleted))
    .returning();
  return deleted ?? null;
}

export async function getSessionWithContacts(id: string) {
  const session = await getSessionById(id);
  if (!session) return null;

  const contactRows = await db
    .select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(and(
      eq(sessionContacts.sessionId, id),
      isNull(contacts.deletedAt),
    ));

  return {
    ...session,
    contacts: contactRows.map((r) => r.contact),
  };
}

export async function getCompletedSessionsByProcess(processId: string) {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.processId, processId),
        inArray(sessions.status, ['completed', 'synthesis_done'] satisfies SessionStatus[]),
        notDeleted,
      )
    )
    .orderBy(sessions.date);
}
