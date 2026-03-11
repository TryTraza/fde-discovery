import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { processes, processModels, processModelSnapshots, sessions, openQuestions, type NewProcess } from '../schema';

const notDeleted = isNull(processes.deletedAt);

export async function createProcess(data: NewProcess) {
  const [process] = await db.insert(processes).values(data).returning();
  return process;
}

export async function createProcessModel(processId: string) {
  const [model] = await db.insert(processModels).values({
    processId,
    steps: [],
    edgeCases: [],
    systems: [],
  }).returning();
  return model;
}

export async function listProcessesByClient(clientId: string) {
  return db.select().from(processes)
    .where(and(eq(processes.clientId, clientId), notDeleted))
    .orderBy(desc(processes.updatedAt));
}

export async function getProcessById(id: string) {
  const [process] = await db.select().from(processes).where(and(eq(processes.id, id), notDeleted));
  return process ?? null;
}

export async function getProcessWithModel(id: string) {
  const process = await getProcessById(id);
  if (!process) return null;
  const [model] = await db.select().from(processModels).where(eq(processModels.processId, id));
  const questions = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.processId, id), isNull(openQuestions.deletedAt)));
  return { ...process, processModel: model ?? null, openQuestions: questions };
}

/**
 * Returns process with all related data.
 *
 * WARNING: This does NOT filter soft-deleted children in artifacts/openQuestions
 * returned via the sessions query. The UI layer MUST filter these.
 */
export async function getProcessWithFullContext(id: string) {
  const process = await getProcessWithModel(id);
  if (!process) return null;
  const processSessions = await db.select().from(sessions)
    .where(and(eq(sessions.processId, id), isNull(sessions.deletedAt)))
    .orderBy(desc(sessions.createdAt));
  return { ...process, sessions: processSessions };
}

export async function updateProcess(id: string, data: Partial<NewProcess>) {
  const [updated] = await db.update(processes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(processes.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function getProcessModel(processId: string) {
  const [model] = await db.select().from(processModels).where(eq(processModels.processId, processId));
  return model ?? null;
}

export async function updateProcessModel(processId: string, data: { steps?: any; edgeCases?: any; systems?: any }) {
  const [updated] = await db.update(processModels)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(processModels.processId, processId))
    .returning();
  return updated ?? null;
}

export async function softDeleteProcess(id: string) {
  const now = new Date();
  const [deleted] = await db.update(processes)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(processes.id, id), notDeleted))
    .returning();
  // NOTE: processModels table lacks deletedAt column — skip cascade.
  // TODO: add deletedAt to process_models in next migration, then cascade here.
  return deleted ?? null;
}

export async function createSnapshot(data: { processModelId: string; trigger: 'synthesis_apply' | 'validation_merge'; sessionId?: string; state: any }) {
  const [snapshot] = await db.insert(processModelSnapshots).values(data).returning();
  return snapshot;
}
