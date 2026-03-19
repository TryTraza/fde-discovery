import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { prepBriefSchema } from '@/lib/ai/schemas/prep-brief';
import { buildPrepBriefPrompt } from '@/lib/ai/prompts/prep-brief';
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
    const aiConfig = await getAIConfig('interview');

    const result = await generateObject({
      model: aiConfig.model,
      schema: prepBriefSchema,
      prompt: buildPrepBriefPrompt(ctx),
    });

    await updateSession(sessionId, { prepBrief: result.object });

    return NextResponse.json(result.object);
  } catch (error) {
    if (error instanceof Error && error.message === 'Session not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return handleAPIError(error);
  }
}
