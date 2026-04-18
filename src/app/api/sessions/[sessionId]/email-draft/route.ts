import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { getSessionById, getPrimaryProcessIdForSession } from '@/lib/db/queries/sessions'
import { getProcessById } from '@/lib/db/queries/processes'
import { getClientById } from '@/lib/db/queries/clients'
import { listContactsByClient } from '@/lib/db/queries/contacts'
import { getAIGateway } from '@/lib/ai/gateway-factory'

function extractHighlights(synthesis: unknown): string {
  if (synthesis && typeof synthesis === 'object' && 'summary' in synthesis) {
    const summary = (synthesis as { summary: unknown }).summary
    if (typeof summary === 'string' && summary.trim()) return summary
  }
  return JSON.stringify(synthesis).slice(0, 500)
}

function extractOpenQuestions(synthesis: unknown): string[] {
  if (!synthesis || typeof synthesis !== 'object' || !('openQuestions' in synthesis)) return []
  const raw = (synthesis as { openQuestions: unknown }).openQuestions
  if (!Array.isArray(raw)) return []
  return raw.map((q) => {
    if (typeof q === 'string') return q
    if (q && typeof q === 'object') {
      const record = q as Record<string, unknown>
      if (typeof record.text === 'string') return record.text
      if (typeof record.question === 'string') return record.question
    }
    return String(q)
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin()
    const { sessionId } = await params

    const session = await getSessionById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (!session.synthesisOutput) {
      return NextResponse.json(
        { error: 'Session has no synthesis output. Run synthesis first.' },
        { status: 400 }
      )
    }

    const primaryProcessId = await getPrimaryProcessIdForSession(session)
    if (!primaryProcessId) {
      return NextResponse.json(
        { error: 'Link this session to a process before drafting email' },
        { status: 422 }
      )
    }

    const process = await getProcessById(primaryProcessId)
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 })
    }

    const client = await getClientById(process.clientId)
    const clientName = client?.name ?? 'Client'
    const contacts = await listContactsByClient(process.clientId)

    const body = await req.json().catch(() => ({}))
    const language: 'en' | 'es' = body.language === 'es' ? 'es' : 'en'

    const { model } = await getAIConfig('research')

    const gateway = getAIGateway('email-draft')
    const email = await gateway.draftEmail({
      clientName,
      processName: process.name,
      contacts: contacts.map((c) => ({ name: c.name, role: c.role })),
      synthesisHighlights: extractHighlights(session.synthesisOutput),
      openQuestions: extractOpenQuestions(session.synthesisOutput),
      language,
      model,
    })

    return NextResponse.json({ email })
  } catch (error) {
    return handleAPIError(error)
  }
}
