import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getClientById } from '@/lib/db/queries/clients'
import { refreshCompanyProfile } from '@/lib/ai/prompts/refresh-company-profile'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const client = await getClientById(id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const profile = await refreshCompanyProfile({
      clientId: id,
      name: client.name,
      industry: client.industry,
      website: client.website,
    })

    return NextResponse.json(profile)
  } catch (error) {
    return handleAPIError(error)
  }
}
