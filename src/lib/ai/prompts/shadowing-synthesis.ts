import type { SessionContext } from '../context';

export function buildShadowingSynthesisPrompt(ctx: SessionContext): string {
  // Group SYSTEM events by system name for detail note aggregation
  const systemEvents = (ctx.events ?? [])
    .filter(e => e.type === 'SYSTEM')
    .reduce((acc, e) => {
      const name = e.label ?? 'Unknown System';
      if (!acc[name]) acc[name] = [];
      if (e.detail) acc[name].push(e.detail);
      return acc;
    }, {} as Record<string, string[]>);

  const modelSection = ctx.process.model
    ? `Current ProcessModel: ${JSON.stringify(ctx.process.model)}`
    : 'No existing process model. Generate from scratch. All steps: changeType "new", stepId null.';

  return `You are analyzing a shadowing session for the FDE Discovery Tool.

## Context

Client: ${ctx.client.name}, ${ctx.client.industry}
Process: ${ctx.process.name} — ${ctx.process.hypothesisText ?? 'No hypothesis'}
${modelSection}

## Session Data

### Chronological Event Log
${JSON.stringify(ctx.events, null, 2)}

### System Events Grouped by System (for detailNotes aggregation)
${JSON.stringify(systemEvents, null, 2)}

### Debrief Answers
${JSON.stringify(ctx.debriefAnswers)}

### Transcript
${ctx.session.transcriptText ?? 'No transcript provided'}

### FDE Personal Notes
${ctx.notes ?? 'No personal notes'}

### Interview Answers
${ctx.session.interviewAnswers ? JSON.stringify(ctx.session.interviewAnswers) : 'None'}

## Instructions

Produce a structured synthesis with these sections:

1. **summary**: One paragraph session summary.

2. **steps**: Updated process steps array. Mark as 'confirmed' if directly observed (logged as STEP). Keep 'inferred' if not observed but still believed to exist. Mark 'missing' if the full flow was observed and this step was skipped. Include insights from debrief answers.

3. **edgeCases**: From EDGE events + described IMPLICIT events. Include frequency estimate and suggested handling.

4. **systems**: From SYSTEM events. For each system:
   - name, confirmed (true if observed), role, details, gaps
   - **detailNotes**: CRITICAL — aggregate ALL detail fields from SYSTEM events for this system into one comprehensive string. This captures column names, sheet names, data mappings, data flows. Example: if "Excel" was logged 3 times with notes "Col A = Supplier", "Sheet: Quotes2024", "data from email body", combine into: "Sheet: Quotes2024\\nCol A = Supplier Name\\nData source: email body"

5. **openQuestions**: From unresolved debrief items, missing steps, unconfirmed systems. With priority.

IMPORTANT: stepId values must exactly match existing model step IDs. Use null for new.
Use priority values: critical, important, nice_to_have.`;
}
