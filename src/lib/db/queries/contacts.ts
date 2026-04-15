import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db } from '../index'
import { contacts, type NewContact } from '../schema'

const notDeleted = isNull(contacts.deletedAt)

export async function createContact(data: NewContact) {
  const [contact] = await db.insert(contacts).values(data).returning()
  return contact
}

export async function listContactsByClient(clientId: string) {
  return db
    .select()
    .from(contacts)
    .where(and(eq(contacts.clientId, clientId), notDeleted))
}

export async function getContactById(id: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), notDeleted))
  return contact ?? null
}

export async function updateContact(id: string, data: Partial<NewContact>) {
  const [updated] = await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), notDeleted))
    .returning()
  return updated ?? null
}

export async function getContactsByIds(ids: string[]) {
  if (ids.length === 0) return []
  return db
    .select()
    .from(contacts)
    .where(and(inArray(contacts.id, ids), notDeleted))
}

// v4: FIX #27 — include updatedAt in soft-delete
export async function softDeleteContact(id: string) {
  const now = new Date()
  const [deleted] = await db
    .update(contacts)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(contacts.id, id))
    .returning()
  return deleted ?? null
}
