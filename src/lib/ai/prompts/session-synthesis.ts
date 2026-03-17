import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import type { SessionContext } from '@/lib/ai/context';

export function buildSynthesisPrompt(ctx: SessionContext): string {
  const typeLabel = getSessionTypeLabel(ctx.session.type);

  const modelSection = ctx.process.model
    ? `## Current Process Model\nSteps: ${JSON.stringify(ctx.process.model.steps)}\nSystems: ${JSON.stringify(ctx.process.model.systems)}\nEdge Cases: ${JSON.stringify(ctx.process.model.edgeCases)}`
    : `## Current Process Model\nNone. Generate from scratch. All steps: changeType "new", stepId null.`;

  const priorContext = ctx.priorSessions
    .filter(s => s.synthesisOutput)
    .map(s => {
      const summary = (s.synthesisOutput as any)?.summary;
      return summary ? `- ${getSessionTypeLabel(s.type)} "${s.title}" (${s.date}): ${summary}` : null;
    })
    .filter(Boolean);

  const contactsContext = ctx.sessionContacts.length > 0
    ? `Session participants: ${ctx.sessionContacts.map(c => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')}`
    : '';

  return `You are analyzing a ${typeLabel} session for "${ctx.process.name}" at ${ctx.client.name} (${ctx.client.industry}).

${ctx.process.description ? `Process description: ${ctx.process.description}` : ''}
${ctx.process.departmentTag ? `Department: ${ctx.process.departmentTag}` : ''}
${contactsContext}
${modelSection}

## Session Input
Transcript:
${ctx.session.transcriptText ?? 'No transcript'}

FDE personal notes:
${ctx.session.notes ?? 'No notes'}

Interview Answers:
${ctx.session.interviewAnswers ? JSON.stringify(ctx.session.interviewAnswers) : 'None'}

Prior Sessions:
${priorContext.length > 0 ? priorContext.join('\n') : 'None'}

## Instructions
Compare session data against current model.
For each step:
- Exists + unchanged: changeType "unchanged", use existing stepId
- Exists + changed: changeType "modified", use existing stepId, include changeReason
- New: changeType "new", stepId null, include changeReason
- Should be removed: changeType "removed", use existing stepId, include changeReason

IMPORTANT: stepId values must exactly match existing model step IDs. Use null for new.

For systems: use the actual field names (name, confirmed, role, details, gaps).
Flag edge cases and generate open questions.
Use priority values: critical, important, nice_to_have.`;
}
