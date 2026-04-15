import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { handleAPIError } from '@/lib/auth/utils'
import { DEFAULT_MODELS } from '@/lib/ai/models'

export async function POST() {
  try {
    const { isAuthenticated, userId } = await auth()
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const apiKey = (user.privateMetadata as Record<string, unknown>)?.anthropicApiKey as
      | string
      | undefined

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key stored. Save your key first.' },
        { status: 422 }
      )
    }

    const anthropic = createAnthropic({ apiKey })
    await generateText({
      model: anthropic(DEFAULT_MODELS.research),
      prompt: 'Say "ok"',
      maxOutputTokens: 10,
    })

    return NextResponse.json({ valid: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
