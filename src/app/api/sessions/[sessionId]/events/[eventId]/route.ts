import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { parseJSON } from '@/lib/api/utils'
import { updateEventSchema } from '@/lib/validations/event'
import { updateEventLabel, updateEventDetail, deleteEvent } from '@/lib/db/queries/events'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; eventId: string }> }
) {
  try {
    await requireAdmin()
    const { eventId } = await params
    const { data, error } = await parseJSON(req)
    if (error) return error

    const parsed = updateEventSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Use existing granular update functions
    let updated = null
    if (parsed.data.label !== undefined) {
      updated = await updateEventLabel(eventId, parsed.data.label)
    }
    if (parsed.data.detail !== undefined) {
      updated = await updateEventDetail(eventId, parsed.data.detail)
    }

    if (!updated) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; eventId: string }> }
) {
  try {
    await requireAdmin()
    const { eventId } = await params
    const deleted = await deleteEvent(eventId)
    if (!deleted) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
