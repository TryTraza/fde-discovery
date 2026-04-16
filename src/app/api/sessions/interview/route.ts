import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { interviewRequestSchema } from '@/lib/validations/session'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { parseJSON } from '@/lib/api/utils'
import { getAIGateway } from '@/lib/ai/gateway-factory'

const MAX_INTERVIEW_QUESTIONS = 3

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
    if (body.questionIndex >= MAX_INTERVIEW_QUESTIONS) {
      return NextResponse.json({ done: true })
    }

    const { model } = await getAIConfig('interview')

    const gateway = getAIGateway('session-interview')
    const question = await gateway.generateInterviewQuestion({
      processId: body.processId,
      previousAnswers: body.previousAnswers ?? [],
      model,
    })

    return NextResponse.json({ done: false, ...question })
  } catch (error) {
    return handleAPIError(error)
  }
}
