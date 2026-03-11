import { NextResponse } from 'next/server';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import {
  getProcessById,
  getProcessWithModel,
  updateProcess,
  softDeleteProcess,
} from '@/lib/db/queries/processes';
import { updateProcessSchema, validateStatusTransition, type ProcessStatus } from '@/lib/validations/process';
import { parseJSON } from '@/lib/api/utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireUserId();
    const { id, processId } = await params;

    const process = await getProcessWithModel(processId);
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    if (process.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    return NextResponse.json(process);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAdmin();
    const { id, processId } = await params;

    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = updateProcessSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await getProcessById(processId);
    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    if (parsed.data.status && parsed.data.status !== existing.status) {
      const transition = validateStatusTransition(
        existing.status as ProcessStatus,
        parsed.data.status
      );
      if (!transition.valid) {
        return NextResponse.json({ error: transition.error }, { status: 422 });
      }
    }

    const updated = await updateProcess(processId, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAdmin();
    const { id, processId } = await params;

    const existing = await getProcessById(processId);
    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    await softDeleteProcess(processId);
    return NextResponse.json({ id: processId, message: 'Process deleted' });
  } catch (error) {
    return handleAPIError(error);
  }
}
