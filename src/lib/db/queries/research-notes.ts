import { eq, desc } from 'drizzle-orm';
import { db } from '../index';
import { researchNotes, type NewResearchNote } from '../schema';

export async function createResearchNote(data: NewResearchNote) {
  const [note] = await db.insert(researchNotes).values(data).returning();
  return note;
}

export async function listResearchNotesByClient(clientId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.clientId, clientId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}

export async function listResearchNotesByProcess(processId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.processId, processId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}
