import { NextResponse } from 'next/server'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { updateSessionSchema } from '@/lib/validations/session'
import {
  getSessionById,
  getSessionWithContacts,
  getLinkedProcesses,
  updateSession,
  softDeleteSession,
} from '@/lib/db/queries/sessions'
import { getProcessById } from '@/lib/db/queries/processes'
import { parseJSON } from '@/lib/api/utils'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireUserId()
    const { sessionId } = await params

    const session = await getSessionWithContacts(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let linkedProcesses = await getLinkedProcesses(sessionId)
    if (linkedProcesses.length === 0 && session.processId) {
      const p = await getProcessById(session.processId)
      if (p) linkedProcesses = [p]
    }
    return NextResponse.json({ ...session, linkedProcesses })
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin()
    const { sessionId } = await params
    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = updateSessionSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await getSessionById(sessionId)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await updateSession(sessionId, parsed.data)
    return NextResponse.json(updated)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin()
    const { sessionId } = await params

    const deleted = await softDeleteSession(sessionId)
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAPIError(error)
  }
}
