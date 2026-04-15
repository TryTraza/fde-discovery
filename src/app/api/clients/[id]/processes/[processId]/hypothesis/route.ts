import { NextResponse } from 'next/server'
import { requireAuthWithUser, handleAPIError } from '@/lib/auth/utils'
import { getProcessById } from '@/lib/db/queries/processes'
import { getClientById } from '@/lib/db/queries/clients'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { getAIGateway } from '@/lib/ai/gateway-factory'
import { persistHypothesisResult } from '@/lib/ai/hypothesis/persist'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    const { role } = await requireAuthWithUser()
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, processId } = await params

    const process = await getProcessById(processId)
    if (!process || process.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 })
    }

    const [client, { model }] = await Promise.all([
      getClientById(id),
      getAIConfig('hypothesis'),
    ])
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Fire-and-forget: return 202-ish immediately; persistence happens async.
    const gateway = getAIGateway('process-hypothesis')
    gateway
      .generateProcessHypothesis({
        processId,
        clientName: client.name,
        clientIndustry: client.industry ?? null,
        clientWebsite: client.website ?? null,
        processName: process.name,
        processDescription: process.description ?? null,
        processDepartment: process.departmentTag ?? null,
        model,
      })
      .then(async (result) => {
        await persistHypothesisResult(processId, result)
        console.log(
          `[hypothesis] Completed for process ${processId}: ${result.initialSteps.length} steps`
        )
      })
      .catch((err) => {
        console.error(`[hypothesis] Failed for process ${processId}:`, err)
      })

    return NextResponse.json({ message: 'Hypothesis generation started' })
  } catch (error) {
    return handleAPIError(error)
  }
}
