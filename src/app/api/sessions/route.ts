import { NextResponse } from 'next/server'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { createSessionSchema } from '@/lib/validations/session'
import {
  listSessionsByProcess,
  createSession,
  createSessionContacts,
} from '@/lib/db/queries/sessions'
import { getProcessById } from '@/lib/db/queries/processes'
import { getContactsByIds } from '@/lib/db/queries/contacts'
import { parseJSON } from '@/lib/api/utils'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  try {
    await requireUserId()
    const { searchParams } = new URL(request.url)
    const processId = searchParams.get('processId')

    if (!processId) {
      return NextResponse.json({ error: 'processId query parameter is required' }, { status: 400 })
    }

    if (!UUID_REGEX.test(processId)) {
      return NextResponse.json({ error: 'processId must be a valid UUID' }, { status: 400 })
    }

    const sessionsList = await listSessionsByProcess(processId)
    return NextResponse.json(sessionsList)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAdmin()
    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = createSessionSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const body = parsed.data

    // Validate process exists
    const process = await getProcessById(body.processId)
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 400 })
    }

    // Validate contactIds exist (already deduplicated by Zod transform)
    if (body.contactIds.length > 0) {
      const existingContacts = await getContactsByIds(body.contactIds)
      if (existingContacts.length !== body.contactIds.length) {
        return NextResponse.json({ error: 'One or more contactIds are invalid' }, { status: 400 })
      }
    }

    // Create session
    const session = await createSession({
      processId: body.processId,
      type: body.type,
      title: body.title,
      date: body.date,
      status: 'planned',
      createdBy: userId,
      interviewAnswers: body.interviewAnswers ?? null,
    })

    // Create session-contact associations
    if (body.contactIds.length > 0) {
      await createSessionContacts(session.id, body.contactIds, {})
    }

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return handleAPIError(error)
  }
}
