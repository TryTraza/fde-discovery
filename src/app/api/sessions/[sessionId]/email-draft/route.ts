import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getProcessById } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { listContactsByClient } from '@/lib/db/queries/contacts';
import { executeAI } from '@/lib/ai/builder';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;

    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.synthesisOutput) {
      return NextResponse.json(
        { error: 'Session has no synthesis output. Run synthesis first.' },
        { status: 400 }
      );
    }

    const process = await getProcessById(session.processId);
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const client = await getClientById(process.clientId);
    const clientName = client?.name ?? 'Client';

    const contacts = await listContactsByClient(process.clientId);

    const body = await req.json().catch(() => ({}));
    const language = body.language === 'es' ? 'es' : 'en';

    const synthesis = session.synthesisOutput as any;
    const highlights = synthesis.summary ?? JSON.stringify(synthesis).slice(0, 500);
    const openQuestions = (synthesis.openQuestions ?? []).map((q: any) => {
      if (typeof q === 'string') return q;
      return q.text ?? q.question ?? String(q);
    });

    // Pre-render template variables (email-draft has no layers — all via overrides)
    const languageInstruction = language === 'es'
      ? 'Write the email entirely in Spanish (formal business Spanish).'
      : 'Write the email in English.';

    const contactsList = contacts
      .map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`)
      .join(', ');

    const openQuestionsList = openQuestions
      .map((q: string, i: number) => `${i + 1}. ${q}`)
      .join('\n');

    const { model, anthropic } = await getAIConfig('research');

    const result = await executeAI({
      agentSlug: 'email-draft',
      params: {},
      userId: '', // Not used since model is pre-resolved
      model,
      anthropic,
      overrides: {
        templateVars: {
          languageInstruction,
          clientName,
          processName: process.name,
          contactsList,
          synthesisHighlights: typeof highlights === 'string' ? highlights : JSON.stringify(highlights),
          openQuestionsList,
        },
      },
    });

    return NextResponse.json({ email: result.text });
  } catch (error) {
    return handleAPIError(error);
  }
}
