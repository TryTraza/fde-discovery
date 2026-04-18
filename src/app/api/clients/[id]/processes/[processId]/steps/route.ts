import { NextResponse } from 'next/server'
import { requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getProcessById, updateProcessModel } from '@/lib/db/queries/processes'
import { updateStepsSchema } from '@/lib/validations/process'
import { parseJSON } from '@/lib/api/utils'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAdmin()
    const { id, processId } = await params

    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = updateStepsSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const process = await getProcessById(processId)
    if (!process || process.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 })
    }

    // Normalize step order based on array position
    const normalizedSteps = parsed.data.steps.map((step, index) => ({
      ...step,
      order: index + 1,
    })) as import('@/lib/db/types').ProcessStep[]

    const updated = await updateProcessModel(processId, { steps: normalizedSteps })
    if (!updated) {
      return NextResponse.json({ error: 'Process model not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return handleAPIError(error)
  }
}
