import { NextResponse } from 'next/server';
import { requireAuthWithUser, handleAPIError } from '@/lib/auth/utils';
import { getProcessById, updateProcess, updateProcessModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { executeAI } from '@/lib/ai/builder';

interface ProcessStepFull {
  id: string;
  name: string;
  description: string;
  order: number;
  systems: Array<{ name: string; confirmed: boolean; detailNotes: string }>;
  confidence: 'inferred';
  edgeCases: [];
  notes: string;
}

function mapAIStepsToProcessSteps(aiSteps: any[]): ProcessStepFull[] {
  return aiSteps.map((step) => ({
    id: crypto.randomUUID(),
    name: step.name,
    description: step.description,
    order: step.order,
    systems: step.systems.map((s: string) => ({
      name: s,
      confirmed: false,
      detailNotes: '',
    })),
    confidence: 'inferred' as const,
    edgeCases: [],
    notes: '',
  }));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    const { role } = await requireAuthWithUser();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, processId } = await params;

    const process = await getProcessById(processId);
    if (!process || process.clientId !== id) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const [client, { model, anthropic }] = await Promise.all([
      getClientById(id),
      getAIConfig('hypothesis'),
    ]);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // Fire-and-forget: start generation, return immediately
    executeAI({
      agentSlug: 'process-hypothesis',
      params: { processId },
      userId: '',
      model,
      anthropic,
      overrides: {
        templateVars: {
          clientName: client.name,
          clientIndustry: client.industry ? `Industry: ${client.industry}` : '',
          clientWebsite: client.website ? `Website: ${client.website}` : '',
          processName: process.name,
          processDescription: process.description ? `Description: ${process.description}` : '',
          processDepartment: process.departmentTag ? `Department: ${process.departmentTag}` : '',
        },
      },
    })
      .then(async (result) => {
        const hypothesis = result.data as any;
        // Write steps BEFORE hypothesisText — UI polls for hypothesisText
        const fullSteps = mapAIStepsToProcessSteps(hypothesis.initialSteps ?? []);

        const modelResult = await updateProcessModel(processId, { steps: fullSteps });
        if (!modelResult) {
          console.warn(`[hypothesis] Model row not found for process ${processId}`);
        }

        await updateProcess(processId, {
          hypothesisText: hypothesis.hypothesisText,
          processTypeL1: hypothesis.matchedProcessType,
        });

        console.log(`[hypothesis] Completed for process ${processId}: ${fullSteps.length} steps`);
      })
      .catch((err) => {
        console.error(`[hypothesis] Failed for process ${processId}:`, err);
      });

    return NextResponse.json({ message: 'Hypothesis generation started' });
  } catch (error) {
    return handleAPIError(error);
  }
}
