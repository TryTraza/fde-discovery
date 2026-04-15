import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth/utils'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { getAIGateway } from '@/lib/ai/gateway-factory'

const ACTIVE_TYPES_WITH_SUGGESTIONS = ['STEP', 'EDGE'] as const

export async function POST(req: NextRequest) {
  try {
    await requireUserId()
    const body = await req.json()
    const { sessionId, activeType } = body

    if (!sessionId || !activeType) {
      return NextResponse.json({ suggestions: [] })
    }
    if (!ACTIVE_TYPES_WITH_SUGGESTIONS.includes(activeType)) {
      return NextResponse.json({ suggestions: [] })
    }

    const { model } = await getAIConfig('suggestions')
    const gateway = getAIGateway('capture-suggestions')
    const suggestions = await gateway.generateCaptureSuggestions({ sessionId, model })

    return NextResponse.json({ suggestions })
  } catch (error) {
    // NEVER return 500 from suggestions — capture UI must not break.
    console.error('Suggestions error:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
