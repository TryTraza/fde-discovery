import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getClientById, updateClient } from '@/lib/db/queries/clients'
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

    const { model } = await getAIConfig('research')

    const gateway = getAIGateway('refresh-company-profile')
    const profile = await gateway.refreshCompanyProfile({
      clientName: client.name,
      clientIndustry: client.industry,
      clientWebsite: client.website,
      model,
    })

    await updateClient(id, { profile })

    return NextResponse.json(profile)
  } catch (error) {
    return handleAPIError(error)
  }
}
