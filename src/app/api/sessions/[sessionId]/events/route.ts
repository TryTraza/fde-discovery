import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireUserId, handleAPIError } from '@/lib/auth/utils';
import { parseJSON } from '@/lib/api/utils';
import { createEventSchema } from '@/lib/validations/event';
import { createEvent, getEventsBySessionId } from '@/lib/db/queries/events';
import type { EventType } from '@/lib/db/schema';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireUserId();
    const { sessionId } = await params;
    const events = await getEventsBySessionId(sessionId);
    return NextResponse.json(events);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;
    const { data, error } = await parseJSON(req);
    if (error) return error;
    const parsed = createEventSchema.safeParse({ ...(data as object), sessionId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const event = await createEvent({
      sessionId: parsed.data.sessionId,
      timestamp: new Date(parsed.data.timestamp),
      type: parsed.data.type as EventType,
      label: parsed.data.label ?? null,
      detail: parsed.data.detail ?? null,
      suggestionUsed: parsed.data.suggestionUsed ?? false,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
