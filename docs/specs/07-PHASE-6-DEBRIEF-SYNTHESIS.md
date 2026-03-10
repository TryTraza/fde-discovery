# Phase 6 — Post-Session Debrief + Synthesis Engine

**Goal:** Debrief enriches events, synthesis aggregates system detail notes, both use per-user AI config.
**Duration:** 3 days
**Gate:** Debrief works, synthesis produces system entries with detailNotes, apply works.

---

## Step 6.1 — Debrief Page

Sequential cards for QUESTION events and unlabeled IMPLICIT events. User resolves each as asked_answered / described / open_question / skip. Full debrief UI code is in Phase 6 of the product spec.

The debrief API route uses `handleAPIError` for consistency, though the debrief itself does not call AI.

---

## Step 6.2 — Shadowing Synthesis — System Detail Notes Aggregation

This is where the system detail notes (captured during SYSTEM button taps) get aggregated into the ProcessModel's `SystemEntry.detailNotes`.

### `src/lib/ai/prompts/synthesis-shadowing.ts`

```typescript
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { z } from 'zod';

const shadowingSynthesisSchema = z.object({
  summary: z.string(),
  processModelUpdates: z.object({
    steps: z.array(z.object({
      id: z.string(),
      order: z.number(),
      name: z.string(),
      description: z.string(),
      confidence: z.enum(['confirmed', 'inferred', 'missing']),
      systems: z.array(z.string()),
      nextSteps: z.array(z.string()),
      branchCondition: z.string().nullable(),
      notes: z.string(),
    })),
    rationale: z.string(),
  }),
  edgeCases: z.array(z.object({
    id: z.string(),
    description: z.string(),
    frequency: z.enum(['rare', 'occasional', 'frequent', 'unknown']),
    suggestedHandling: z.string(),
    status: z.enum(['open', 'needs_clarification', 'resolved']),
    relatedStepId: z.string().optional(),
  })),
  systems: z.array(z.object({
    name: z.string(),
    confirmed: z.boolean(),
    role: z.string(),
    details: z.string(),
    gaps: z.string(),
    detailNotes: z.string().describe(
      'Aggregate all observed detail about this system: column names, sheet names, ' +
      'data mappings between systems (e.g. "email subject → Excel Col A"), ' +
      'file paths, naming conventions. Combine notes from all SYSTEM events for this system.'
    ),
  })),
  openQuestions: z.array(z.object({
    text: z.string(),
    priority: z.enum(['critical', 'important', 'nice_to_have']),
  })),
});

export async function runShadowingSynthesis(sessionId: string) {
  const { model } = await getAIConfig('synthesis');
  const session = await getSessionWithFullContext(sessionId);
  const l1 = getL1(session.process.processTypeL1);

  // Build SYSTEM events with their detail notes for the prompt
  const systemEvents = session.eventLogs
    .filter((e: any) => e.type === 'SYSTEM')
    .map((e: any) => ({
      system: e.label,
      detailNotes: e.detail,  // The notes captured during SYSTEM button tap
      timestamp: e.timestamp,
    }));

  const { object } = await generateObject({
    model,
    schema: shadowingSynthesisSchema,
    maxTokens: 4000,
    system: `Analyze a shadowing session. You have the event log, debrief answers, transcript, and the FDE's personal notes.

IMPORTANT for SYSTEMS: When you see SYSTEM events with detail notes (like column names, sheet names, data mappings), aggregate ALL notes for each system into its detailNotes field. This captures HOW the system is used — which columns hold what data, which sheets are used, how data flows between systems (e.g., "supplier name from email → Column A in Excel"). This is critical operational intelligence.`,
    prompt: `Client: ${session.process.client.name}, ${session.process.client.industry}
Process: ${session.process.name} — ${session.process.hypothesisText}
Current ProcessModel: ${JSON.stringify(session.process.processModel)}
Domain knowledge: ${JSON.stringify(l1)}
Interview answers (session goals): ${JSON.stringify(session.interviewAnswers)}

Event log:
${JSON.stringify(session.eventLogs.map((e: any) => ({
  time: e.timestamp,
  type: e.type,
  label: e.label,
  detail: e.detail,
})))}

System events with detail notes (for column/sheet/mapping capture):
${JSON.stringify(systemEvents)}

Debrief answers:
${JSON.stringify(session.debriefAnswers)}

Transcript: ${session.transcriptText ?? 'No transcript provided'}

FDE's personal notes: ${session.notes ?? 'No personal notes'}

Generate structured synthesis. For each system, aggregate all detail notes into a comprehensive detailNotes field that captures the complete picture of how that system is used (columns, sheets, mappings, data flows).`,
  });

  await updateSession(sessionId, {
    synthesisOutput: object,
    aiSummary: object.summary.slice(0, 200),
  });

  return object;
}
```

> **Key:** The synthesis prompt explicitly tells the AI to aggregate system detail notes. If the user logged "Excel" three times during capture with different notes ("Col A = Supplier", "Sheet: Quotes2024", "data from email body"), the synthesis combines them into one comprehensive `detailNotes` string on the Excel SystemEntry.

---

## Step 6.3 — Apply Changes — Merge System detailNotes

### Updated merge function in apply route:

```typescript
function mergeSystemEntries(
  existing: SystemEntry[],
  incoming: SystemEntry[]
): SystemEntry[] {
  const map = new Map(existing.map((s) => [s.name, s]));

  for (const sys of incoming) {
    if (map.has(sys.name)) {
      const current = map.get(sys.name)!;
      map.set(sys.name, {
        ...current,
        confirmed: current.confirmed || sys.confirmed,
        role: sys.role || current.role,
        details: [current.details, sys.details].filter(Boolean).join('; '),
        gaps: [current.gaps, sys.gaps].filter(Boolean).join('; '),
        // Append new detailNotes to existing (accumulate across sessions)
        detailNotes: [current.detailNotes, sys.detailNotes]
          .filter(Boolean)
          .join('\n---\n'),  // Separator between sessions' notes
        sourceSessionId: sys.sourceSessionId || current.sourceSessionId,
      });
    } else {
      map.set(sys.name, sys);
    }
  }

  return Array.from(map.values());
}
```

---

## Step 6.4 — Synthesis Display — Show System Detail Notes

In the Systems Map panel of the synthesis display:

```tsx
{/* Systems Map Panel */}
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>System</TableHead>
      <TableHead>Confirmed</TableHead>
      <TableHead>Role</TableHead>
      <TableHead>Details</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {synthesisOutput.systems.map((sys) => (
      <TableRow key={sys.name}>
        <TableCell className="font-medium">{sys.name}</TableCell>
        <TableCell>
          <Switch checked={sys.confirmed} />
        </TableCell>
        <TableCell>{sys.role}</TableCell>
        <TableCell>
          <div className="space-y-1">
            <p className="text-sm">{sys.details}</p>
            {sys.detailNotes && (
              <div className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap">
                {sys.detailNotes}
              </div>
            )}
            {sys.gaps && (
              <p className="text-xs text-orange-600">Gaps: {sys.gaps}</p>
            )}
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

The `detailNotes` is displayed in a monospace block to preserve formatting of column listings and mappings.

---

## Step 6.5 — Non-Shadowing Synthesis (Updated)

Same as Phase 4 but with both transcript and notes in the prompt:

```typescript
prompt: `...
Transcript: ${session.transcriptText ?? 'No transcript provided'}
FDE personal notes: ${session.notes ?? 'No personal notes'}
...`
```

---

## Phase 6 Gate Checklist

- [ ] Debrief screen loads QUESTION + unlabeled IMPLICIT events
- [ ] All resolution types work (answered, described, open_question, skip)
- [ ] Synthesis uses user's `synthesis` model preference
- [ ] **Synthesis prompt includes both transcript AND notes**
- [ ] **Synthesis aggregates SYSTEM event detail notes into SystemEntry.detailNotes**
- [ ] **Systems Map panel shows detailNotes in monospace block**
- [ ] Apply changes creates snapshot
- [ ] Apply merges system detailNotes (appends, doesn't replace)
- [ ] Open questions created from synthesis appear on Process Overview
