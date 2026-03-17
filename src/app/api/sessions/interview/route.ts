import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { interviewRequestSchema } from '@/lib/validations/session';
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview';
import { buildInterviewPrompt } from '@/lib/ai/prompts/session-interview';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { parseJSON } from '@/lib/api/utils';
import { generateObject } from 'ai';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = interviewRequestSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Short-circuit when all questions answered
    if (body.questionIndex >= 3) {
      return NextResponse.json({ done: true });
    }

    const process = await getProcessWithModel(body.processId);
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const client = await getClientById(process.clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const aiConfig = await getAIConfig('interview');

    const result = await generateObject({
      model: aiConfig.model,
      schema: interviewQuestionSchema,
      prompt: buildInterviewPrompt({
        client: {
          name: client.name,
          industry: client.industry,
          website: client.website,
          aiSummary: client.aiSummary,
        },
        processContext: {
          name: process.name,
          description: process.description,
          hypothesisText: process.hypothesisText ?? null,
          model: process.processModel,
          departmentTag: process.departmentTag,
        },
        sessionType: body.sessionType,
        sessionContacts: [], // No contacts assigned yet during creation
        previousAnswers: body.previousAnswers,
        questionIndex: body.questionIndex,
      }),
    });

    return NextResponse.json({ done: false, ...result.object });
  } catch (error) {
    return handleAPIError(error);
  }
}
