import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { parseJSON } from '@/lib/api/utils'
import { createEventBatchSchema } from '@/lib/validations/event'
import { createEventsBatch } from '@/lib/db/queries/events'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin()
    const { sessionId } = await params
    const { data, error } = await parseJSON(req)
    if (error) return error

    const body = data as Record<string, unknown>
    // Override sessionId from URL param for all events (security)
    const eventsWithSessionId = (Array.isArray(body.events) ? body.events : []).map((e: any) => ({
      ...e,
      sessionId,
    }))

    const parsed = createEventBatchSchema.safeParse({ events: eventsWithSessionId })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const events = await createEventsBatch(parsed.data.events)
    return NextResponse.json({ created: events.length, events }, { status: 201 })
  } catch (error) {
    return handleAPIError(error)
  }
}
