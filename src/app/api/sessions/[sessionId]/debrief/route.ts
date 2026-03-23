// Binding table (Step 0):
// - debrief column: sessions.debriefAnswers (JSONB, camelCase)
// - session status enum: 'planned' | 'in_progress' | 'completed' | 'synthesis_done'
// - getDebriefEvents: src/lib/db/queries/events.ts:24
// - DebriefItem / DebriefAnswers: src/lib/db/types.ts:71-84
// - openQuestions table: processId (required), sessionId (optional), text, priority, status
// - getSessionById returns null for not-found or soft-deleted
// - Transaction pattern: tx.insert / tx.update (NOT standalone query fns)

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireUserId, handleAPIError } from '@/lib/auth/utils';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getEventsBySessionId, getDebriefEvents } from '@/lib/db/queries/events';
import { db } from '@/lib/db';
import { sessions, eventLogs, openQuestions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { debriefSubmissionSchema } from '@/lib/validations/debrief';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;

    // Fetch session
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Validate session type
    if (session.type !== 'shadowing') {
      return NextResponse.json(
        { error: 'Debrief is only available for shadowing sessions' },
        { status: 400 }
      );
    }

    // Validate session status
    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Session must be completed before debrief' },
        { status: 400 }
      );
    }

    // Check debrief not already done
    if (session.debriefAnswers !== null) {
      return NextResponse.json(
        { error: 'Debrief has already been completed for this session' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const result = debriefSubmissionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.issues },
        { status: 400 }
      );
    }

    // Check for duplicate eventLogIds
    const ids = result.data.items.map(i => i.eventLogId);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { error: 'Duplicate eventLogId in items array' },
        { status: 400 }
      );
    }

    // Pre-fetch all events for validation (before transaction)
    const allEvents = await getEventsBySessionId(sessionId);
    const eventMap = new Map(allEvents.map(e => [e.id, e]));

    // Validate all eventLogIds exist
    for (const item of result.data.items) {
      if (!eventMap.has(item.eventLogId)) {
        return NextResponse.json(
          { error: `Invalid eventLogId: ${item.eventLogId}` },
          { status: 400 }
        );
      }
    }

    // Process items in transaction
    const processedItems = [...result.data.items.map(item => ({
      ...item,
      openQuestionCreated: item.resolution === 'open_question',
      openQuestionId: undefined as string | undefined,
    }))];

    await db.transaction(async (tx) => {
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];

        // Create open question for open_question resolution
        if (item.resolution === 'open_question') {
          const event = eventMap.get(item.eventLogId)!;
          const text = item.type === 'question'
            ? (event.label ?? event.detail ?? 'Unresolved question from shadowing')
            : (item.description ?? 'Unresolved observation during shadowing');

          const [created] = await tx.insert(openQuestions).values({
            processId: session.processId,
            sessionId: sessionId,
            text,
            priority: item.priority!,
            status: 'open',
          }).returning();

          processedItems[i] = { ...item, openQuestionId: created.id };
        }

        // Update event label for described IMPLICIT events
        if (item.resolution === 'described' && item.type === 'implicit') {
          await tx.update(eventLogs)
            .set({ label: item.description })
            .where(eq(eventLogs.id, item.eventLogId));
        }
      }

      // Save debrief answers to session
      await tx.update(sessions)
        .set({
          debriefAnswers: { items: processedItems },
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));
    });

    return NextResponse.json({ success: true, items: processedItems });
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireUserId();
    const { sessionId } = await params;

    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const events = await getDebriefEvents(sessionId);
    return NextResponse.json(events);
  } catch (error) {
    return handleAPIError(error);
  }
}
