import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/utils';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { executeAI } from '@/lib/ai/builder';

export async function POST(req: NextRequest) {
  try {
    await requireUserId();
    const body = await req.json();
    const { sessionId, activeType } = body;

    if (!sessionId || !activeType) {
      return NextResponse.json({ suggestions: [] });
    }

    // Only STEP and EDGE get suggestions
    if (activeType !== 'STEP' && activeType !== 'EDGE') {
      return NextResponse.json({ suggestions: [] });
    }

    const { model, anthropic } = await getAIConfig('suggestions');

    const result = await executeAI({
      agentSlug: 'capture-suggestions',
      params: { sessionId },
      userId: '',
      model,
      anthropic,
    });

    return NextResponse.json({ suggestions: (result.data as any)?.suggestions ?? [] });
  } catch (error) {
    // NEVER return 500 from suggestions — capture UI must not break
    console.error('Suggestions error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
