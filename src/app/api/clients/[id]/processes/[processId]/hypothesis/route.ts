import { NextResponse } from 'next/server';
import { requireAuthWithUser, handleAPIError } from '@/lib/auth/utils';
import { getProcessById } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { triggerProcessHypothesis } from '@/lib/ai/prompts/process-hypothesis';
import { getAIConfig } from '@/lib/ai/get-ai-config';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    const { role, user } = await requireAuthWithUser();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, processId } = await params;

    const process = await getProcessById(processId);
    if (!process || process.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const client = await getClientById(id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // Resolve AI model NOW while Clerk auth context is still available.
    // triggerProcessHypothesis runs fire-and-forget — auth() won't work later.
    const { model } = await getAIConfig('hypothesis');

    triggerProcessHypothesis(
      processId,
      { name: client.name, industry: client.industry, website: client.website },
      {
        name: process.name,
        description: process.description ?? undefined,
      },
      model
    );

    return NextResponse.json({ message: 'Hypothesis generation started' });
  } catch (error) {
    return handleAPIError(error);
  }
}
