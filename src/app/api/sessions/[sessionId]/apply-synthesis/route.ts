import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { applySynthesisSchema } from '@/lib/validations/apply-synthesis'
import { mergeSteps, mergeEdgeCases, mergeSystems } from '@/lib/utils/merge-process-model'
import { getSessionById, sessionIsLinkedToProcess } from '@/lib/db/queries/sessions'
import { getProcessWithModel } from '@/lib/db/queries/processes'
import { db } from '@/lib/db'
import { processModels, processModelSnapshots, openQuestions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis'
import { buildGraphFromLegacyModel } from '@/lib/ai/graph/build-graph'
import { parseJSON } from '@/lib/api/utils'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    await requireAdmin()

    const session = await getSessionById(sessionId)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const synthesisData = session.synthesisOutput as SynthesisOutput | null
    if (!synthesisData) {
      return NextResponse.json({ error: 'No synthesis result' }, { status: 400 })
    }

    const { data: bodyRaw, error: parseErr } = await parseJSON(request)
    if (parseErr) return parseErr

    const parsed = applySynthesisSchema.safeParse(bodyRaw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const options = parsed.data
    const targetProcessId = options.targetProcessId
    const synthesis = synthesisData

    const linked = await sessionIsLinkedToProcess(sessionId, targetProcessId)
    if (!linked) {
      return NextResponse.json(
        { error: 'Session is not linked to the target process' },
        { status: 400 }
      )
    }

    const process = await getProcessWithModel(targetProcessId)
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 })

    const result = await db.transaction(async (tx) => {
      let currentModel = process.processModel

      if (!currentModel) {
        const [created] = await tx
          .insert(processModels)
          .values({
            processId: targetProcessId,
            steps: [],
            systems: [],
            edgeCases: [],
          })
          .returning()
        currentModel = created
      }

      await tx.insert(processModelSnapshots).values({
        processModelId: currentModel.id,
        trigger: 'synthesis_apply',
        state: {
          steps: currentModel.steps ?? [],
          systems: currentModel.systems ?? [],
          edgeCases: currentModel.edgeCases ?? [],
        },
        sessionId,
      })

      let updatedSteps = [...((currentModel.steps as any[]) ?? [])]
      let updatedEdgeCases = [...((currentModel.edgeCases as any[]) ?? [])]
      let updatedSystems = [...((currentModel.systems as any[]) ?? [])]

      if (options.applySteps) updatedSteps = mergeSteps(updatedSteps, synthesis.steps)
      if (options.applyEdgeCases)
        updatedEdgeCases = mergeEdgeCases(updatedEdgeCases, synthesis.edgeCases)
      if (options.applySystems) updatedSystems = mergeSystems(updatedSystems, synthesis.systems)

      let graph: ReturnType<typeof buildGraphFromLegacyModel> | null = null
      try {
        graph = buildGraphFromLegacyModel({
          steps: updatedSteps,
          edgeCases: updatedEdgeCases,
          systems: updatedSystems,
        })
      } catch (err) {
        console.warn(`[apply-synthesis] Could not build graph for process_model ${currentModel.id}:`, err)
      }

      await tx
        .update(processModels)
        .set({
          steps: updatedSteps,
          systems: updatedSystems,
          edgeCases: updatedEdgeCases,
          graph,
          updatedAt: new Date(),
        })
        .where(eq(processModels.id, currentModel.id))

      if (options.applyQuestions && synthesis.openQuestions.length > 0) {
        for (const q of synthesis.openQuestions) {
          await tx.insert(openQuestions).values({
            processId: targetProcessId,
            sessionId,
            text: q.text,
            priority: q.priority,
            status: 'open',
          })
        }
      }

      return { success: true }
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleAPIError(error)
  }
}
