import { eq, and, isNull, ilike, inArray, desc } from 'drizzle-orm'
import { db } from '../index'
import { clients, contacts, processes, type NewClient } from '../schema'

const notDeleted = isNull(clients.deletedAt)

export async function createClient(data: NewClient) {
  const [client] = await db.insert(clients).values(data).returning()
  return client
}

export async function listClients(filters?: {
  search?: string
  status?: string[]
  industry?: string[]
}) {
  const conditions = [notDeleted]
  if (filters?.search) conditions.push(ilike(clients.name, `%${filters.search}%`))
  if (filters?.status?.length) conditions.push(inArray(clients.status, filters.status as any))
  if (filters?.industry?.length) conditions.push(inArray(clients.industry, filters.industry))

  return db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(desc(clients.updatedAt))
}

export async function getClientById(id: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), notDeleted))
  return client ?? null
}

export async function getClientWithRelations(id: string) {
  const client = await getClientById(id)
  if (!client) return null
  const clientContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.clientId, id), isNull(contacts.deletedAt)))
  const clientProcesses = await db
    .select()
    .from(processes)
    .where(and(eq(processes.clientId, id), isNull(processes.deletedAt)))
  return { ...client, contacts: clientContacts, processes: clientProcesses }
}

export async function updateClient(id: string, data: Partial<NewClient>) {
  const [updated] = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, id), notDeleted))
    .returning()
  return updated ?? null
}

export async function softDeleteClient(id: string) {
  const now = new Date()
  // v4: FIX #27 — include updatedAt in all soft-delete operations
  await db.update(contacts).set({ deletedAt: now, updatedAt: now }).where(eq(contacts.clientId, id))
  await db
    .update(processes)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(processes.clientId, id))
  const [deleted] = await db
    .update(clients)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(clients.id, id))
    .returning()
  return deleted ?? null
}
