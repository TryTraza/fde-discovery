import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { synthesisOutputSchema } from '@/lib/ai/schemas/synthesis';
import { buildSynthesisPrompt } from '@/lib/ai/prompts/session-synthesis';
import { buildShadowingSynthesisPrompt } from '@/lib/ai/prompts/shadowing-synthesis';
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

    // Shadowing session synthesis
    if (ctx.session.type === 'shadowing') {
      if (ctx.debriefAnswers === null || ctx.debriefAnswers === undefined) {
        return NextResponse.json(
          { error: 'Complete the debrief before running synthesis on shadowing sessions.' },
          { status: 400 }
        );
      }

      try {
        const { model } = await getAIConfig('synthesis');
        const prompt = buildShadowingSynthesisPrompt(ctx);

        const result = await generateObject({
          model,
          schema: synthesisOutputSchema,
          maxOutputTokens: 4000,
          system: 'You are an expert process analyst. Analyze a shadowing session and produce structured updates to the process model.',
          prompt,
        });

        await updateSession(sessionId, {
          synthesisOutput: result.object,
          status: 'synthesis_done',
        });

        return NextResponse.json(result.object);
      } catch (error) {
        console.error('Shadowing synthesis failed:', error);
        return NextResponse.json(
          { error: 'Synthesis failed. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Non-shadowing session synthesis
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
