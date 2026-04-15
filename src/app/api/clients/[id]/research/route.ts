import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getClientById } from '@/lib/db/queries/clients'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { triggerCompanyResearchViaBuilder } from '@/lib/ai/trigger-research'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await getClientById(id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Resolve model NOW while auth context is available
    const { model, anthropic } = await getAIConfig('research')
    triggerCompanyResearchViaBuilder(id, client, model, anthropic)

    return NextResponse.json({ message: 'Research started' })
  } catch (error) {
    return handleAPIError(error)
  }
}
