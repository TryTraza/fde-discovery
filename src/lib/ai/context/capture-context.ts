import { getSessionById, getPrimaryProcessIdForSession } from '@/lib/db/queries/sessions'
import { getEventsBySessionId } from '@/lib/db/queries/events'
import { getProcessWithModel } from '@/lib/db/queries/processes'
import { getL1 } from '@/lib/domain/l1'

export interface CaptureContext {
  processTypeL1: string | null
  l1Library: any | null
  recentEvents: Array<{
    type: string
    label: string | null
    timestamp: string
  }>
  processModelSteps: Array<{
    name: string
    description: string
    confidence: string
  }>
  interviewAnswers: any
}

export async function buildCaptureContext(sessionId: string): Promise<CaptureContext> {
  const session = await getSessionById(sessionId)
  if (!session) {
    return {
      processTypeL1: null,
      l1Library: null,
      recentEvents: [],
      processModelSteps: [],
      interviewAnswers: null,
    }
  }

  const primaryPid = await getPrimaryProcessIdForSession(session)
  const process = primaryPid ? await getProcessWithModel(primaryPid) : null

  let l1Library = null
  if (process?.processTypeL1) {
    try {
      l1Library = getL1(process.processTypeL1)
    } catch {
      // L1 not found for this process type — suggestions will be generic
    }
  }

  const dbEvents = await getEventsBySessionId(sessionId)
  const recentEvents = dbEvents.slice(-20).map((e) => ({
    type: e.type,
    label: e.label,
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp),
  }))

  const steps = (process?.processModel?.steps ?? []) as Array<{
    name: string
    description: string
    confidence: string
  }>

  return {
    processTypeL1: process?.processTypeL1 ?? null,
    l1Library,
    recentEvents,
    processModelSteps: steps,
    interviewAnswers: session.interviewAnswers,
  }
}
