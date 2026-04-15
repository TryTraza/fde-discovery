import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { interviewRequestSchema } from '@/lib/validations/session'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { parseJSON } from '@/lib/api/utils'
import { executeAI } from '@/lib/ai/builder'

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = interviewRequestSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const body = parsed.data

    // Short-circuit when all questions answered
    if (body.questionIndex >= 3) {
      return NextResponse.json({ done: true })
    }

    const { model, anthropic } = await getAIConfig('interview')

    // Pre-render previous answers for template interpolation
    let previousAnswersSection = 'This is the first question — no previous answers yet.'
    if (body.previousAnswers && body.previousAnswers.length > 0) {
      previousAnswersSection = body.previousAnswers
        .map((a: any, i: number) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
        .join('\n\n')
    }

    const result = await executeAI({
      agentSlug: 'session-interview',
      params: { processId: body.processId },
      userId: '',
      model,
      anthropic,
      overrides: {
        templateVars: {
          previousAnswersSection,
        },
      },
    })

    return NextResponse.json({ done: false, ...(result.data as object) })
  } catch (error) {
    return handleAPIError(error)
  }
}
