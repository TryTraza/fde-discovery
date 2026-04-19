import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientResearch, type ClientResearch } from '@/lib/db/schema'
import type { ClientResearchPayload } from '@/lib/ai/contracts'

export async function getResearchByClientId(clientId: string): Promise<ClientResearch | null> {
  const [row] = await db
    .select()
    .from(clientResearch)
    .where(eq(clientResearch.clientId, clientId))
  return row ?? null
}

export async function upsertClientResearch(
  clientId: string,
  payload: ClientResearchPayload
): Promise<ClientResearch> {
  const researchedAt = new Date(payload.researchedAt)
  const values = {
    clientId,
    companyOverview: payload.companyOverview ?? null,
    sizeFinancials: payload.sizeFinancials ?? null,
    customersMarkets: payload.customersMarkets ?? null,
    painPoints: payload.painPoints ?? null,
    recentNews: payload.recentNews ?? null,
    fitScore: payload.fitScore ?? null,
    fitScoreRationale: payload.fitScoreRationale ?? null,
    areasOfExpertise: payload.areasOfExpertise,
    productsAndServices: payload.productsAndServices,
    keyStakeholders: payload.keyStakeholders,
    techStack: payload.techStack,
    researchSources: payload.researchSources,
    researchedAt,
    schemaVersion: payload.schemaVersion,
  }
  const [row] = await db
    .insert(clientResearch)
    .values(values)
    .onConflictDoUpdate({
      target: clientResearch.clientId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  return row
}

export async function deleteResearchByClientId(clientId: string): Promise<void> {
  await db.delete(clientResearch).where(eq(clientResearch.clientId, clientId))
}
