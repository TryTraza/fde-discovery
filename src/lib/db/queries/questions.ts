import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import { db } from '../index';
import { openQuestions, type NewOpenQuestion } from '../schema';

const notDeleted = isNull(openQuestions.deletedAt);

export async function createOpenQuestion(data: NewOpenQuestion) {
  const [question] = await db.insert(openQuestions).values(data).returning();
  return question;
}

export async function listQuestionsByProcess(processId: string) {
  return db.select().from(openQuestions)
    .where(and(eq(openQuestions.processId, processId), notDeleted))
    .orderBy(desc(openQuestions.createdAt));
}

export async function getOpenQuestionsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(openQuestions)
    .where(and(inArray(openQuestions.id, ids), notDeleted));
}

export async function updateOpenQuestion(id: string, data: Partial<NewOpenQuestion>) {
  const [updated] = await db.update(openQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(openQuestions.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function resolveQuestion(id: string, resolutionNotes: string) {
  return updateOpenQuestion(id, {
    status: 'resolved' as const,
    resolvedAt: new Date(),
    resolutionNotes,
  });
}
