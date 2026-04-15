import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { listAgents } from '@/lib/db/queries/ai-agents'

export async function GET() {
  try {
    await requireAdmin()
    const agents = await listAgents()
    return NextResponse.json(agents)
  } catch (error) {
    return handleAPIError(error)
  }
}
