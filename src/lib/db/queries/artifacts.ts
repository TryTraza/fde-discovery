import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { artifacts, type NewArtifact } from '../schema';

const notDeleted = isNull(artifacts.deletedAt);

export async function createArtifact(data: NewArtifact) {
  const [artifact] = await db.insert(artifacts).values(data).returning();
  return artifact;
}

export async function listArtifactsByProcess(processId: string) {
  return db.select().from(artifacts)
    .where(and(eq(artifacts.processId, processId), notDeleted))
    .orderBy(desc(artifacts.createdAt));
}

export async function updateArtifact(id: string, data: Partial<NewArtifact>) {
  const [updated] = await db.update(artifacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(artifacts.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

// v4: FIX #27 — include updatedAt in soft-delete
export async function softDeleteArtifact(id: string) {
  const now = new Date();
  const [deleted] = await db.update(artifacts)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(artifacts.id, id)).returning();
  return deleted ?? null;
}
