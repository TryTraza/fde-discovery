import { NextResponse } from 'next/server';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { updateSessionSchema } from '@/lib/validations/session';
import {
  getSessionById,
  getSessionWithContacts,
  updateSession,
  softDeleteSession,
} from '@/lib/db/queries/sessions';
import { parseJSON } from '@/lib/api/utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireUserId();
    const { sessionId } = await params;

    const session = await getSessionWithContacts(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;
    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = updateSessionSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await updateSession(sessionId, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;

    const deleted = await softDeleteSession(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
