import { NextResponse } from 'next/server'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getClientById } from '@/lib/db/queries/clients'
import {
  listProcessesByClient,
  createProcess,
  createProcessModel,
  softDeleteProcess,
  updateProcess,
  updateProcessModel,
} from '@/lib/db/queries/processes'
import { getAIConfig } from '@/lib/ai/get-ai-config'
import { executeAI } from '@/lib/ai/builder'
import { createProcessSchema } from '@/lib/validations/process'
import { parseJSON } from '@/lib/api/utils'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserId()
    const { id } = await params

    const client = await getClientById(id)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const processes = await listProcessesByClient(id)
    return NextResponse.json(processes)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const client = await getClientById(id)
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = createProcessSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    let process: any
    try {
      process = await createProcess({
        clientId: id,
        name: parsed.data.name,
        description: parsed.data.description,
        departmentTag: parsed.data.departmentTag,
      })
      await createProcessModel(process.id)
    } catch (err) {
      if (process?.id) {
        await softDeleteProcess(process.id).catch(() => {})
      }
      console.error('[POST /processes] Failed to create process + model:', err)
      return NextResponse.json({ error: 'Failed to create process' }, { status: 500 })
    }

    // Resolve AI model NOW while Clerk auth context is still available
    try {
      const { model, anthropic } = await getAIConfig('hypothesis')

      executeAI({
        agentSlug: 'process-hypothesis',
        params: { processId: process.id },
        userId: '',
        model,
        anthropic,
        overrides: {
          templateVars: {
            clientName: client.name,
            clientIndustry: client.industry ? `Industry: ${client.industry}` : '',
            clientWebsite: client.website ? `Website: ${client.website}` : '',
            processName: parsed.data.name,
            processDescription: parsed.data.description
              ? `Description: ${parsed.data.description}`
              : '',
            processDepartment: parsed.data.departmentTag
              ? `Department: ${parsed.data.departmentTag}`
              : '',
          },
        },
      })
        .then(async (result) => {
          const hypothesis = result.data as any
          const fullSteps = (hypothesis.initialSteps ?? []).map((step: any) => ({
            id: crypto.randomUUID(),
            name: step.name,
            description: step.description,
            order: step.order,
            systems: step.systems.map((s: string) => ({
              name: s,
              confirmed: false,
              detailNotes: '',
            })),
            confidence: 'inferred' as const,
            edgeCases: [],
            notes: '',
          }))

          await updateProcessModel(process.id, { steps: fullSteps }).catch(() => {})
          await updateProcess(process.id, {
            hypothesisText: hypothesis.hypothesisText,
            processTypeL1: hypothesis.matchedProcessType,
          })
        })
        .catch((err) => {
          console.error(`[hypothesis] Failed for process ${process.id}:`, err)
        })
    } catch {
      // No API key or auth issue — process created but hypothesis skipped
    }

    return NextResponse.json(process, { status: 201 })
  } catch (error) {
    return handleAPIError(error)
  }
}
