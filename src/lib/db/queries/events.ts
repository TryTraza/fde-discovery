import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../index'
import { eventLogs, type EventType, type NewEventLog } from '../schema'
import type { CreateEventInput } from '@/lib/validations/event'
// Note: CreateEventInput.type is `string` (widened by EVENT_TYPES_MUTABLE cast).
// We cast to EventType in the batch function below.

export async function createEvent(data: NewEventLog) {
  const [event] = await db.insert(eventLogs).values(data).returning()
  return event
}

export async function getEventsBySessionId(sessionId: string) {
  return db
    .select()
    .from(eventLogs)
    .where(eq(eventLogs.sessionId, sessionId))
    .orderBy(eventLogs.timestamp)
}

export async function getEventById(id: string) {
  const [event] = await db.select().from(eventLogs).where(eq(eventLogs.id, id))
  return event ?? null
}

export async function getDebriefEvents(sessionId: string) {
  return db
    .select()
    .from(eventLogs)
    .where(
      and(
        eq(eventLogs.sessionId, sessionId),
        or(
          eq(eventLogs.type, 'QUESTION' satisfies EventType),
          and(eq(eventLogs.type, 'IMPLICIT' satisfies EventType), isNull(eventLogs.label))
        )
      )
    )
    .orderBy(eventLogs.timestamp)
}

export async function updateEventLabel(id: string, label: string) {
  const [updated] = await db
    .update(eventLogs)
    .set({ label })
    .where(eq(eventLogs.id, id))
    .returning()
  return updated ?? null
}

export async function updateEventDetail(id: string, detail: string) {
  const [updated] = await db
    .update(eventLogs)
    .set({ detail })
    .where(eq(eventLogs.id, id))
    .returning()
  return updated ?? null
}

export async function deleteEvent(id: string) {
  const [deleted] = await db.delete(eventLogs).where(eq(eventLogs.id, id)).returning()
  return deleted ?? null
}

export async function createEventsBatch(events: CreateEventInput[]) {
  const rows = await db
    .insert(eventLogs)
    .values(
      events.map((e) => ({
        sessionId: e.sessionId,
        timestamp: new Date(e.timestamp),
        type: e.type as EventType,
        label: e.label ?? null,
        detail: e.detail ?? null,
        suggestionUsed: e.suggestionUsed ?? false,
      }))
    )
    .returning()
  return rows
}
