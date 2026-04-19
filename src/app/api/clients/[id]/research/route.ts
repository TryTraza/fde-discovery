import { NextResponse } from 'next/server'
import { requireAdmin, requireUserId, handleAPIError } from '@/lib/auth/utils'
import { getClientById } from '@/lib/db/queries/clients'
import {
  getResearchByClientId,
  upsertClientResearch,
} from '@/lib/db/queries/client-research'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { getAIGateway } from '@/lib/ai/gateway-factory'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await getClientById(id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { model, anthropic } = await getAIConfig('research')
    const payload = await getAIGateway('client-research').researchClient({
      clientName: client.name,
      clientIndustry: client.industry,
      clientWebsite: client.website ?? null,
      model,
      anthropic,
    })
    const persisted = await upsertClientResearch(id, payload)
    return NextResponse.json(persisted)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserId()
    const { id } = await params
    const research = await getResearchByClientId(id)
    return NextResponse.json(research)
  } catch (error) {
    return handleAPIError(error)
  }
}
