import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { synthesisOutputSchema } from '@/lib/ai/schemas/synthesis';
import { buildSynthesisPrompt } from '@/lib/ai/prompts/session-synthesis';
import { buildSessionContext } from '@/lib/ai/context';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { updateSession } from '@/lib/db/queries/sessions';
import { generateObject } from 'ai';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await requireAdmin();

    const ctx = await buildSessionContext(sessionId);

    if (ctx.session.status !== 'completed') {
      return NextResponse.json(
        { error: `Session must be completed. Current: ${ctx.session.status}` },
        { status: 400 }
      );
    }

    if (!ctx.session.transcriptText && !ctx.session.notes) {
      return NextResponse.json(
        { error: 'Session must have transcript or notes' },
        { status: 400 }
      );
    }

    const aiConfig = await getAIConfig('synthesis');

    const result = await generateObject({
      model: aiConfig.model,
      schema: synthesisOutputSchema,
      prompt: buildSynthesisPrompt(ctx),
    });

    await updateSession(sessionId, {
      synthesisOutput: result.object,
      status: 'synthesis_done',
    });

    return NextResponse.json(result.object);
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return handleAPIError(error);
  }
}
