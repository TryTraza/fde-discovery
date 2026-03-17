import { getSessionTypeLabel } from '@/lib/utils/session-labels';
import type { SessionContext } from '@/lib/ai/context';

export function buildPrepBriefPrompt(ctx: SessionContext): string {
  const typeLabel = getSessionTypeLabel(ctx.session.type);

  const modelSection = ctx.process.model
    ? `Current process model:\nSteps: ${JSON.stringify(ctx.process.model.steps)}\nSystems: ${JSON.stringify(ctx.process.model.systems)}\nEdge Cases: ${JSON.stringify(ctx.process.model.edgeCases)}`
    : 'No process model yet — this is one of the first sessions.';

  const priorContext = ctx.priorSessions.length > 0
    ? ctx.priorSessions.map(s => {
        const summary = (s.synthesisOutput as any)?.summary;
        const interviewGoals = s.interviewAnswers?.questions?.map((q: any) => q.answer).join('; ');
        return `- ${getSessionTypeLabel(s.type)}: "${s.title}" (${s.date})${summary ? ` — ${summary}` : ''}${interviewGoals ? `\n  Goals: ${interviewGoals}` : ''}`;
      }).join('\n')
    : 'No prior sessions.';

  const interviewAnswers = ctx.session.interviewAnswers?.questions;
  const interviewContext = interviewAnswers?.length
    ? `FDE's session goals (from pre-session interview):\n${interviewAnswers.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`
    : 'No pre-session interview answers available.';

  const contactsContext = ctx.sessionContacts.length > 0
    ? `Session participants:\n${ctx.sessionContacts.map(c => `- ${c.name}${c.role ? ` (${c.role})` : ''}${c.department ? `, ${c.department}` : ''}`).join('\n')}`
    : 'No contacts assigned.';

  return `You are preparing an actionable session brief for an FDE (Field Discovery Engineer) who is about to run a "${typeLabel}" session for the process "${ctx.process.name}".

Company: ${ctx.client.name}
Industry: ${ctx.client.industry}
${ctx.client.website ? `Website: ${ctx.client.website}` : ''}
${ctx.client.aiSummary ? `Company research: ${ctx.client.aiSummary}` : ''}

Process: ${ctx.process.name}
${ctx.process.description ? `Description: ${ctx.process.description}` : ''}
${ctx.process.departmentTag ? `Department: ${ctx.process.departmentTag}` : ''}
${modelSection}

${contactsContext}

Prior sessions for this process:
${priorContext}

${interviewContext}

Based on the FDE's goals, the company context, the process model, and any gaps from prior sessions, generate a comprehensive prep brief:

1. summary: A concise overview of what this session should accomplish, tailored to the FDE's stated goals and the company context
2. questionsToAsk: 5-8 refined, specific questions the FDE should ask during the session. Each question should:
   - Be directly tied to the FDE's goals or known gaps
   - Include a rationale explaining why it matters
   - Include a follow-up for when answers are vague
   - Be ordered by priority (most important first)
   - Reference specific systems, steps, or people when possible
3. approaches: 2-4 tactical approaches for the session (e.g., "Start with the happy path, then probe exceptions", "Ask for a live walkthrough of the system")
4. areasToProbe: 3-5 specific areas where the FDE should push for deeper answers, evidence, or demonstrations
5. watchFor: 2-3 red flags or signals that might indicate hidden complexity, workarounds, or pain points

Be specific to this company, industry, and process context. Avoid generic advice — every item should be actionable and relevant.`;
}
