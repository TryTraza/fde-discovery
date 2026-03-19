import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { applySynthesisSchema } from '@/lib/validations/apply-synthesis';
import { mergeSteps, mergeEdgeCases, mergeSystems } from '@/lib/utils/merge-process-model';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { db } from '@/lib/db';
import { processModels, processModelSnapshots, openQuestions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await requireAdmin();

    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const synthesisData = session.synthesisOutput as SynthesisOutput | null;
    if (!synthesisData) {
      return NextResponse.json({ error: 'No synthesis result' }, { status: 400 });
    }

    const bodyRaw = await request.json().catch(() => ({}));
    const parsed = applySynthesisSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const options = parsed.data;
    const synthesis = synthesisData;

    const process = await getProcessWithModel(session.processId);
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      let currentModel = process.processModel;

      // Create empty model if none exists
      if (!currentModel) {
        const [created] = await tx
          .insert(processModels)
          .values({
            processId: session.processId,
            steps: [],
            systems: [],
            edgeCases: [],
          })
          .returning();
        currentModel = created;
      }

      // Snapshot current state before changes
      await tx.insert(processModelSnapshots).values({
        processModelId: currentModel.id,
        trigger: 'synthesis_apply',
        state: {
          steps: currentModel.steps ?? [],
          systems: currentModel.systems ?? [],
          edgeCases: currentModel.edgeCases ?? [],
        },
        sessionId,
      });

      // Merge
      let updatedSteps = [...(currentModel.steps as any[] ?? [])];
      let updatedEdgeCases = [...(currentModel.edgeCases as any[] ?? [])];
      let updatedSystems = [...(currentModel.systems as any[] ?? [])];

      if (options.applySteps) updatedSteps = mergeSteps(updatedSteps, synthesis.steps);
      if (options.applyEdgeCases) updatedEdgeCases = mergeEdgeCases(updatedEdgeCases, synthesis.edgeCases);
      if (options.applySystems) updatedSystems = mergeSystems(updatedSystems, synthesis.systems);

      // Update model
      await tx
        .update(processModels)
        .set({
          steps: updatedSteps,
          systems: updatedSystems,
          edgeCases: updatedEdgeCases,
          updatedAt: new Date(),
        })
        .where(eq(processModels.id, currentModel.id));

      // Insert open questions
      if (options.applyQuestions && synthesis.openQuestions.length > 0) {
        for (const q of synthesis.openQuestions) {
          await tx.insert(openQuestions).values({
            processId: session.processId,
            sessionId,
            text: q.text,
            priority: q.priority,
            status: 'open',
          });
        }
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
