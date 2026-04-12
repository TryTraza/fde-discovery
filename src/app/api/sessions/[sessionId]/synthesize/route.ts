import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getSessionById, updateSession } from '@/lib/db/queries/sessions';
import { executeAI } from '@/lib/ai/builder';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await requireAdmin();

    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: `Session must be completed. Current: ${session.status}` },
        { status: 400 }
      );
    }

    // Shadowing synthesis
    if (session.type === 'shadowing') {
      if (session.debriefAnswers === null || session.debriefAnswers === undefined) {
        return NextResponse.json(
          { error: 'Complete the debrief before running synthesis on shadowing sessions.' },
          { status: 400 }
        );
      }

      try {
        const { model, anthropic } = await getAIConfig('synthesis');

        const result = await executeAI({
          agentSlug: 'shadowing-synthesis',
          params: { sessionId },
          userId: '',
          model,
          anthropic,
        });

        await updateSession(sessionId, {
          synthesisOutput: result.data,
          status: 'synthesis_done',
        });

        return NextResponse.json(result.data);
      } catch (error) {
        console.error('Shadowing synthesis failed:', error);
        return NextResponse.json(
          { error: 'Synthesis failed. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Non-shadowing session synthesis
    if (!session.transcriptText && !session.notes) {
      return NextResponse.json(
        { error: 'Session must have transcript or notes' },
        { status: 400 }
      );
    }

    const { model, anthropic } = await getAIConfig('synthesis');

    const result = await executeAI({
      agentSlug: 'session-synthesis',
      params: { sessionId },
      userId: '',
      model,
      anthropic,
    });

    await updateSession(sessionId, {
      synthesisOutput: result.data,
      status: 'synthesis_done',
    });

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return handleAPIError(error);
  }
}
