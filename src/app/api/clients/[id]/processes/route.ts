import { NextResponse } from 'next/server';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getClientById } from '@/lib/db/queries/clients';
import {
  listProcessesByClient,
  createProcess,
  createProcessModel,
  softDeleteProcess,
} from '@/lib/db/queries/processes';
import { triggerProcessHypothesis } from '@/lib/ai/prompts/process-hypothesis';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { createProcessSchema } from '@/lib/validations/process';
import { parseJSON } from '@/lib/api/utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUserId();
    const { id } = await params;

    const client = await getClientById(id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const processes = await listProcessesByClient(id);
    return NextResponse.json(processes);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const client = await getClientById(id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = createProcessSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let process: any;
    try {
      process = await createProcess({
        clientId: id,
        name: parsed.data.name,
        description: parsed.data.description,
        departmentTag: parsed.data.departmentTag,
      });
      await createProcessModel(process.id);
    } catch (err) {
      if (process?.id) {
        await softDeleteProcess(process.id).catch(() => {});
      }
      console.error('[POST /processes] Failed to create process + model:', err);
      return NextResponse.json({ error: 'Failed to create process' }, { status: 500 });
    }

    // Resolve AI model NOW while Clerk auth context is still available.
    // triggerProcessHypothesis runs fire-and-forget — auth() won't work later.
    try {
      const { model } = await getAIConfig('hypothesis');
      triggerProcessHypothesis(
        process.id,
        { name: client.name, industry: client.industry, website: client.website },
        {
          name: parsed.data.name,
          description: parsed.data.description,
          departmentTag: parsed.data.departmentTag,
          knownSystems: parsed.data.knownSystems,
          knownPainPoints: parsed.data.knownPainPoints,
        },
        model
      );
    } catch {
      // No API key or auth issue — process created but hypothesis skipped.
      // User can regenerate later from the process detail page.
    }

    return NextResponse.json(process, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
