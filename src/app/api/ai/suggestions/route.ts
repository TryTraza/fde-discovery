import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/utils';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { generateObject } from 'ai';
import { suggestionsSchema } from '@/lib/ai/schemas/suggestions';
import { buildCapturePrompt } from '@/lib/ai/prompts/capture-suggestions';
import { buildCaptureContext } from '@/lib/ai/context/capture-context';

export async function POST(req: NextRequest) {
  try {
    await requireUserId();
    const body = await req.json();
    const { sessionId, activeType, eventCount } = body;

    if (!sessionId || !activeType) {
      return NextResponse.json({ suggestions: [] });
    }

    // Only STEP and EDGE get suggestions
    if (activeType !== 'STEP' && activeType !== 'EDGE') {
      return NextResponse.json({ suggestions: [] });
    }

    const aiConfig = await getAIConfig('suggestions');
    const context = await buildCaptureContext(sessionId);

    const { object } = await generateObject({
      model: aiConfig.model,
      schema: suggestionsSchema,
      prompt: buildCapturePrompt(context, activeType),
      maxOutputTokens: 500,
    });

    return NextResponse.json({ suggestions: object.suggestions });
  } catch (error) {
    // NEVER return 500 from suggestions — capture UI must not break
    console.error('Suggestions error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
