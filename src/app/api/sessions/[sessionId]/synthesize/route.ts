import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { getSessionById, updateSession } from '@/lib/db/queries/sessions'
import { getAIGateway } from '@/lib/ai/gateway-factory'
import { synthesisOutputSchema, type SynthesisOutput } from '@/lib/ai/schemas/synthesis'

function validateSynthesisOutput(
  data: unknown
): { ok: true; data: SynthesisOutput } | { ok: false } {
  const parsed = synthesisOutputSchema.safeParse(data)
  if (!parsed.success) {
    console.error('Synthesis output failed schema validation:', parsed.error.flatten())
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    await requireAdmin()

    const session = await getSessionById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: `Session must be completed. Current: ${session.status}` },
        { status: 400 }
      )
    }

    const isShadowing = session.type === 'shadowing'

    if (isShadowing) {
      if (session.debriefAnswers === null || session.debriefAnswers === undefined) {
        return NextResponse.json(
          { error: 'Complete the debrief before running synthesis on shadowing sessions.' },
          { status: 400 }
        )
      }
    } else if (!session.transcriptText && !session.notes) {
      return NextResponse.json(
        { error: 'Session must have transcript or notes' },
        { status: 400 }
      )
    }

    const { model } = await getAIConfig('synthesis')
    const gateway = getAIGateway(isShadowing ? 'shadowing-synthesis' : 'session-synthesis')

    let raw: SynthesisOutput
    try {
      raw = isShadowing
        ? await gateway.synthesizeShadowing({ sessionId, model })
        : await gateway.synthesizeSession({ sessionId, model })
    } catch (error) {
      console.error(`${isShadowing ? 'Shadowing' : 'Session'} synthesis failed:`, error)
      return handleAPIError(error)
    }

    const validated = validateSynthesisOutput(raw)
    if (!validated.ok) {
      return NextResponse.json(
        { error: 'Synthesis output did not match expected shape.' },
        { status: 500 }
      )
    }

    await updateSession(sessionId, {
      synthesisOutput: validated.data,
      status: 'synthesis_done',
    })

    return NextResponse.json(validated.data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return handleAPIError(error)
  }
}
