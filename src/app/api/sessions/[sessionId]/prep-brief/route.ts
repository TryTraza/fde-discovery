import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { updateSession } from '@/lib/db/queries/sessions'
import { getAIGateway } from '@/lib/ai/gateway-factory'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    await requireAdmin()

    const { model } = await getAIConfig('interview')
    const gateway = getAIGateway('prep-brief')

    const prepBrief = await gateway.generatePrepBrief({ sessionId, model })

    await updateSession(sessionId, { prepBrief })

    return NextResponse.json(prepBrief)
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return handleAPIError(error)
  }
}
