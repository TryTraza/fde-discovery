import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { updateSession } from '@/lib/db/queries/sessions'
import { executeAI } from '@/lib/ai/builder'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    await requireAdmin()

    const { model, anthropic } = await getAIConfig('interview')

    const result = await executeAI({
      agentSlug: 'prep-brief',
      params: { sessionId },
      userId: '',
      model,
      anthropic,
    })

    await updateSession(sessionId, { prepBrief: result.data })

    return NextResponse.json(result.data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return handleAPIError(error)
  }
}
