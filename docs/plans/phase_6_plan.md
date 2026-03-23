# Phase 6 — Debrief + Synthesis Implementation Plan

**Goal:** Post-shadowing debrief flow (resolving QUESTION/IMPLICIT events), shadowing-specific synthesis that aggregates system detail notes into `SystemEntry.detailNotes`, and updates the apply/display layer to handle this new field.

**Duration:** 3 days

**Gate:** Shadowing session can complete debrief → run synthesis → apply changes with detailNotes preserved on systems.

**Implementation order:** 6.0 → 6.1 → 6.2 → 6.3 → 6.4 → 6.5 (binding table → API → page → synthesis → merge → display)

---

## Step 0: Binding Table (pre-flight)

**Goal:** Resolve actual naming, column names, function signatures, and file paths via grep before writing any code.

Before touching any code, the junior developer runs these commands and records the answers. Every subsequent step references this table instead of guessing.

```bash
# 1. Session table column names for debrief
grep -n 'debriefAnswers\|debrief_answers' src/lib/db/schema.ts

# 2. Session status enum values
grep -n 'sessionStatus\|session_status' src/lib/db/schema.ts

# 3. Existing getDebriefEvents function signature and location
grep -rn 'getDebriefEvents' src/lib/db/queries/

# 4. DebriefItem type definition
grep -n 'DebriefItem' src/lib/db/types.ts

# 5. DebriefAnswers type definition
grep -n 'DebriefAnswers' src/lib/db/types.ts

# 6. Existing events GET route — current query params
grep -rn 'searchParams\|debrief\|needsDebrief' src/app/api/sessions/*/events/route.ts

# 7. SystemEntry type — check for detailNotes field
grep -n 'detailNotes' src/lib/db/types.ts

# 8. Existing synthesis schema — current fields on synthesisSystemSchema
grep -A 20 'synthesisSystemSchema\|systemSchema' src/lib/ai/schemas/synthesis.ts

# 9. Existing synthesis route — current structure
grep -n 'session.type\|shadowing\|buildSynthesisPrompt\|generateObject' src/app/api/sessions/*/synthesize/route.ts

# 10. Existing merge-process-model — mergeSystems function
grep -A 40 'mergeSystems\|function merge' src/lib/utils/merge-process-model.ts

# 11. Existing context builder — SessionContext type
grep -A 15 'SessionContext\|buildSessionContext' src/lib/ai/context.ts

# 12. Open questions table — required fields for insert
grep -A 10 'openQuestions' src/lib/db/schema.ts | head -20

# 13. createOpenQuestion function signature
grep -rn 'createOpenQuestion' src/lib/db/queries/

# 14. parseJSON utility location
grep -rn 'parseJSON' src/lib/api/

# 15. requireAdmin / requireAuth imports
grep -rn 'requireAdmin' src/lib/auth/

# 16. handleAPIError import
grep -rn 'handleAPIError' src/lib/auth/

# 17. getAIConfig import and usage pattern
grep -rn 'getAIConfig' src/lib/ai/

# 18. synthesis-panels.tsx — systems display section
grep -n 'sys\.\|system\|Systems' src/components/sessions/synthesis-panels.tsx

# 19. session-overview.tsx — existing synthesis gating logic
grep -n 'synthesis\|debrief\|synthesize' src/components/sessions/session-overview.tsx

# 20. getSessionById / getSessionWithFullContext return shape
grep -A 10 'getSessionById\|getSessionWithFullContext' src/lib/db/queries/sessions.ts

# 21. Check if getSessionWithFullContext already loads eventLogs
grep -A 20 'getSessionWithFullContext' src/lib/db/queries/sessions.ts

# 22. Check eventLogs import path for use inside transactions
grep -n 'eventLogs' src/lib/db/schema.ts | head -5

# 23. Check db transaction pattern used in apply-synthesis
grep -B 2 -A 20 'db.transaction\|\.transaction' src/app/api/sessions/*/apply-synthesis/route.ts

# 24. Check if apply-synthesis destructures or filters system fields
grep -A 10 'systems\|\.map\|spread\|destructure' src/app/api/sessions/*/apply-synthesis/route.ts

# 25. Check existing session-overview.tsx for session type branching pattern
grep -B 2 -A 5 'session\.type\|shadowing\|discovery\|validation' src/components/sessions/session-overview.tsx

# 26. Check existing synthesize route for how non-shadowing synthesis is structured
grep -B 5 -A 30 'generateObject' src/app/api/sessions/*/synthesize/route.ts

# 27. Check updateSession function signature
grep -rn 'updateSession' src/lib/db/queries/sessions.ts | head -5

# 28. Check getEventsBySessionId function signature
grep -rn 'getEventsBySessionId' src/lib/db/queries/events.ts | head -5
```

**Record findings in a comment block at the top of each new file** with the actual resolved values. Example:

```typescript
// Binding table (Step 0):
// - debrief column: sessions.debriefAnswers (JSONB, camelCase)
// - session status enum: 'planned' | 'in_progress' | 'completed' | 'synthesis_done'
// - getDebriefEvents: src/lib/db/queries/events.ts:24
// - parseJSON: src/lib/api/utils.ts
// - getSessionWithFullContext loads eventLogs: YES (no separate fetch needed)
// - eventLogs table import: src/lib/db/schema.ts
// - apply-synthesis does NOT destructure/filter system fields (passes through)
// - existing synthesize route has single generateObject call at line XX
```

---

## Step 1: Debrief API Route (spec 6.2)

**Goal:** POST endpoint to save debrief answers + create open questions. GET endpoint to retrieve debrief-eligible events.

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/validations/debrief.ts` | Zod schema for debrief submission |
| `src/app/api/sessions/[sessionId]/debrief/route.ts` | POST + GET handlers |
| `src/__tests__/api/sessions-debrief.test.ts` | Tests (RED first) |

### Files to MODIFY

| File | Change |
|------|--------|
| `src/app/api/sessions/[sessionId]/events/route.ts` | Add `?debrief=true` query param to GET handler |

### Test plan (18 tests, written first)

```
describe('POST /api/sessions/[sessionId]/debrief')
  1. returns 401 when unauthenticated
  2. returns 403 when user has viewer role
  3. returns 404 when session does not exist
  4. returns 400 when session type is not 'shadowing'
  5. returns 400 when session status is 'planned' (must be post-capture)
  6. returns 400 when session status is 'in_progress' (must be post-capture)
  7. returns 400 when session already has debriefAnswers (debrief already done)
  8. returns 400 when body fails validation (bad resolution value, missing required fields)
  9. returns 400 when resolution is 'asked_answered' but type is 'implicit' (type mismatch)
  10. returns 400 when resolution is 'described' but type is 'question' (type mismatch)
  11. returns 400 when resolution is 'asked_answered' but answer is empty string
  12. returns 400 when resolution is 'open_question' but priority is missing
  13. returns 200 and saves debrief answers to session.debriefAnswers
  14. returns 200 and creates open questions for items with resolution 'open_question' (verify openQuestionId set on returned items)
  15. returns 200 with empty items array when no events need debrief (graceful no-op — sets debriefAnswers to { items: [] })
  16. returns 400 when eventLogId references a non-existent event
  17. creates open questions atomically — if one insert fails, nothing is committed (mock failure)
  18. updates eventLog label for 'described' IMPLICIT events within the transaction

describe('GET /api/sessions/[sessionId]/debrief')
  19. returns 401 when unauthenticated
  20. returns 404 when session does not exist
  21. returns only QUESTION events and IMPLICIT events with null label
  22. returns empty array when no matching events exist
```

### Validation schema (`src/lib/validations/debrief.ts`)

```typescript
import { z } from 'zod';

// Resolution types vary by event type:
// - QUESTION events: 'asked_answered' | 'open_question' | 'skipped'
// - IMPLICIT events: 'described' | 'open_question' | 'skipped'

const debriefItemSchema = z.object({
  eventLogId: z.string().uuid(),
  type: z.enum(['question', 'implicit']),
  resolution: z.enum(['asked_answered', 'described', 'open_question', 'skipped']),
  answer: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'important', 'nice_to_have']).optional(),
}).superRefine((item, ctx) => {
  // asked_answered requires answer AND must be a QUESTION event
  if (item.resolution === 'asked_answered') {
    if (item.type !== 'question') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'asked_answered' resolution is only valid for question events",
        path: ['resolution'],
      });
    }
    if (!item.answer?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'asked_answered' resolution requires a non-empty answer",
        path: ['answer'],
      });
    }
  }

  // described requires description AND must be an IMPLICIT event
  if (item.resolution === 'described') {
    if (item.type !== 'implicit') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'described' resolution is only valid for implicit events",
        path: ['resolution'],
      });
    }
    if (!item.description?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'described' resolution requires a non-empty description",
        path: ['description'],
      });
    }
  }

  // open_question requires priority (valid for both event types)
  if (item.resolution === 'open_question') {
    if (!item.priority) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'open_question' resolution requires a priority",
        path: ['priority'],
      });
    }
  }

  // skipped: no additional fields required (valid for both event types)
});

export const debriefSubmissionSchema = z.object({
  items: z.array(debriefItemSchema),
});

export type DebriefSubmission = z.infer<typeof debriefSubmissionSchema>;
```

**Why `superRefine` over `refine`:** `refine` produces a single generic error message for the entire object. `superRefine` produces per-field errors that map directly to UI form fields, enabling the debrief panel (Step 2) to highlight the specific input that needs fixing. This is critical for the sequential card UX where the user needs to know exactly what's wrong.

### POST handler logic (`src/app/api/sessions/[sessionId]/debrief/route.ts`)

```
1. requireAdmin()
2. const { sessionId } = await params
3. Fetch session by ID via getSessionById(sessionId). 404 if not found.
4. Validate: session.type === 'shadowing' → 400 if not
5. Validate: session.status === 'completed' → 400 if not
     (only 'completed' is valid — 'planned', 'in_progress', 'synthesis_done' all rejected)
6. Validate: session.debriefAnswers === null → 400 if already has debrief
7. Parse body with debriefSubmissionSchema. 400 on failure (return Zod issues as error details).

8. Pre-fetch: load all events for this session ONCE before entering the transaction:
     const allEvents = await getEventsBySessionId(sessionId);
     const eventMap = new Map(allEvents.map(e => [e.id, e]));

9. Validate all eventLogIds exist:
     for each item in parsedBody.items:
       if (!eventMap.has(item.eventLogId)) → return 400 'Invalid eventLogId: {id}'

10. Begin db.transaction(async (tx) => { ... }):

   a. For each item where resolution === 'open_question':
      - const event = eventMap.get(item.eventLogId)!
      - Determine text:
        - QUESTION items: event.label ?? event.detail ?? 'Unresolved question from shadowing'
        - IMPLICIT items: item.description ?? 'Unresolved observation during shadowing'
      - Insert into openQuestions via tx.insert(openQuestions).values({
          processId: session.processId,  // direct FK on sessions table — no join needed
          sessionId: sessionId,
          text: determinedText,
          priority: item.priority!,
          status: 'open',
        }).returning()
      - Capture returned ID
      - Mutate the item: set openQuestionId = returned.id

   b. For each item where resolution === 'described' (IMPLICIT events):
      - Update the eventLog record INSIDE the transaction:
        tx.update(eventLogs)
          .set({ label: item.description })
          .where(eq(eventLogs.id, item.eventLogId))
      - IMPORTANT: Do NOT call the standalone updateEventLabel() function here.
        It uses the outer `db` instance, not the transaction's `tx`, so it would
        NOT be atomic. Use tx.update() directly.

   c. Update session via tx.update(sessions):
      set debriefAnswers = { items: processedItems }
      set updatedAt = new Date()

11. Return 200 with { success: true, items: processedItems }
```

**Error response format for validation failures:**

```typescript
// On Zod parse failure, return structured errors:
const result = debriefSubmissionSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: result.error.issues },
    { status: 400 }
  );
}
```

**Import checklist for the route file:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth } from '@/lib/auth'; // verify path in Step 0 #15
import { handleAPIError } from '@/lib/auth';              // verify path in Step 0 #16
import { getSessionById } from '@/lib/db/queries/sessions';
import { getEventsBySessionId, getDebriefEvents } from '@/lib/db/queries/events';
import { db } from '@/lib/db';
import { sessions, eventLogs, openQuestions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { debriefSubmissionSchema } from '@/lib/validations/debrief';
```

### GET handler logic (`src/app/api/sessions/[sessionId]/debrief/route.ts`)

```
1. requireAuth()
2. const { sessionId } = await params
3. Fetch session by ID via getSessionById(sessionId). 404 if not found.
4. Call getDebriefEvents(sessionId) — already exists in events.ts per Step 0 #3
5. Return NextResponse.json(events)
```

### Modification to events GET route

Add to the existing GET handler in `src/app/api/sessions/[sessionId]/events/route.ts`:

```typescript
const url = new URL(req.url);
const isDebrief = url.searchParams.get('debrief') === 'true';

if (isDebrief) {
  const events = await getDebriefEvents(sessionId);
  return NextResponse.json(events);
}

// ... existing logic for normal event fetching (unchanged)
```

**Note:** The debrief panel UI (Step 2) uses the dedicated GET `/debrief` route, not this query param. This `?debrief=true` param on the events route is a convenience alias for debugging or future use. Both return the same data.

### Risks

- **Atomicity:** Open question creation + event label update + debrief save MUST all be in the same `db.transaction()`. If any insert fails, nothing is committed. Follow the same pattern from apply-synthesis route (verify in Step 0 #23).
- **processId resolution:** `session.processId` is a direct FK on the sessions table — no join needed. Verify this in Step 0 binding table.
- **Event text for open questions:** When creating an open question from a QUESTION event, the question text comes from the event's `label` or `detail` field. When creating from an IMPLICIT event marked as `open_question`, use `item.description` if provided, otherwise a default string. The event record is fetched via `eventMap` BEFORE the transaction starts — no queries inside the loop.
- **Transaction scope for event updates:** The `updateEventLabel()` query function from `events.ts` uses the module-level `db` instance. Inside a transaction, you MUST use `tx.update()` instead, otherwise the update runs outside the transaction and atomicity is broken. This is a common Drizzle footgun.
- **Duplicate eventLogIds:** The current validation checks that each eventLogId exists, but does NOT check for duplicates within the items array. If the same eventLogId appears twice, the second update/insert would silently overwrite the first. Mitigation: add a uniqueness check after parsing:
  ```typescript
  const ids = result.data.items.map(i => i.eventLogId);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: 'Duplicate eventLogId in items array' },
      { status: 400 }
    );
  }
  ```

---

## Step 2: Debrief Page UI (spec 6.1)

**Goal:** Sequential card flow for resolving debrief events, embedded in session overview.

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/components/sessions/debrief-panel.tsx` | Sequential card component |

### Files to MODIFY

| File | Change |
|------|--------|
| `src/components/sessions/session-overview.tsx` | Show debrief panel for shadowing sessions; gate synthesis behind debrief completion |

### Component design (`debrief-panel.tsx`)

**Props:**

```typescript
interface DebriefPanelProps {
  sessionId: string;
  processId: string;
  onComplete: () => void; // called after successful save to trigger SWR mutate
}
```

**State:**

```typescript
const [debriefEvents, setDebriefEvents] = useState<EventLog[]>([]);
const [allEvents, setAllEvents] = useState<EventLog[]>([]); // for context display
const [currentIndex, setCurrentIndex] = useState(0);
const [answers, setAnswers] = useState<Map<string, Partial<DebriefItem>>>(new Map());
const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Flow:**

1. On mount: two parallel fetches:
   - `GET /api/sessions/${sessionId}/debrief` → debrief-eligible events
   - `GET /api/sessions/${sessionId}/events` → all events (for context display)
2. If debrief events array is empty: call `POST /api/sessions/${sessionId}/debrief` with `{ items: [] }` immediately (auto-skip), then call `onComplete()`. Show brief "No items to review" message. **On error:** show error toast with retry button — do NOT silently fail or leave the user stuck. The retry button re-attempts the POST.
3. If events exist: show sequential cards.

**Each card shows:**

- Event type badge (QUESTION / IMPLICIT) + timestamp
- Event text (label and/or detail)
- Context: "Logged after: [previous event summary]" — look up the event immediately before this one by timestamp in `allEvents`
- Resolution options vary by type:
  - **QUESTION events:** "Asked & answered" (textarea for answer) | "Still open → open question" (priority selector) | "Skip"
  - **IMPLICIT events:** "I can describe it" (textarea for description) | "Keep as open question" (priority selector) | "Skip"
- "Next" button (enabled when a resolution is selected)
- "Back" button (enabled when currentIndex > 0)
- Progress indicator: "Event 2 of 7"

**Resolution option rendering logic (prevents invalid type/resolution combos at the UI level):**

```typescript
const resolutionOptions = event.type === 'QUESTION'
  ? ['asked_answered', 'open_question', 'skipped'] as const
  : ['described', 'open_question', 'skipped'] as const;
```

This ensures the user can never select `asked_answered` for an IMPLICIT event or `described` for a QUESTION event. The Zod `superRefine` validation on the API is a second safety net, not the primary guard.

**Final card (review screen):**

- Summary: X answered, Y described, Z open questions, W skipped
- List of all items with their resolutions (editable — click to go back to that card)
- "Save Debrief" button → POST to debrief route
- On success: call `onComplete()` to trigger re-render
- On error: show error toast with message from API response, keep form state intact for retry. Parse API error:
  ```typescript
  const errorData = await response.json();
  setError(errorData.error ?? 'Failed to save debrief. Please try again.');
  ```

**Data loss prevention:**

```typescript
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (answers.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [answers.size]);
```

### Integration into `session-overview.tsx`

**Important:** Before writing this code, check Step 0 #25 for the existing branching pattern. The code below assumes no existing session type branching exists and establishes the pattern. If branching already exists, slot the shadowing logic into the existing pattern.

Add this logic for shadowing sessions in the session detail area:

```typescript
// Shadowing session debrief gating logic
if (session.type === 'shadowing' && session.status === 'completed') {
  if (session.debriefAnswers === null) {
    // Debrief not done yet — show debrief panel, hide synthesis button
    return (
      <>
        <DebriefPanel
          sessionId={session.id}
          processId={session.processId}
          onComplete={mutate}
        />
        {/* Synthesis button is NOT rendered here */}
      </>
    );
  } else {
    // Debrief complete — show summary + synthesis button
    return (
      <>
        <DebriefSummaryBadge answers={session.debriefAnswers} />
        {/* Existing synthesis button renders here */}
      </>
    );
  }
}

// For non-shadowing sessions: existing behavior unchanged
```

**DebriefSummaryBadge** is a small inline component (can live in the same file or extract):

```typescript
function DebriefSummaryBadge({ answers }: { answers: DebriefAnswers }) {
  const items = answers.items ?? [];
  const answered = items.filter(i => i.resolution === 'asked_answered').length;
  const described = items.filter(i => i.resolution === 'described').length;
  const open = items.filter(i => i.resolution === 'open_question').length;
  const skipped = items.filter(i => i.resolution === 'skipped').length;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
        Debrief complete
      </Badge>
      <span>{answered} answered, {described} described, {open} open, {skipped} skipped</span>
    </div>
  );
}
```

### Tests

No separate unit tests for the card UI. The debrief-panel logic is tested through the API tests in Step 1. However, the integration gating (synthesis blocked until debrief complete) is tested in Step 3, test #1.

### Risks

- **Zero debrief events edge case:** Handled by auto-posting empty debrief (sets `debriefAnswers: { items: [] }`) so synthesis is unblocked. Error handling on the auto-skip POST prevents the user from getting stuck in an un-actionable state.
- **User navigating away mid-debrief:** Answers live in component state only. No persistence until "Save Debrief" is clicked. `beforeunload` warning prevents accidental data loss.
- **Context event fetching:** To show "Context: logged after STEP X", fetch the full event list once on mount (separate call to `GET /api/sessions/${sessionId}/events` without `?debrief=true`), then look up the event immediately before each debrief event by timestamp.
- **Fetch error on mount:** If either the debrief events fetch or the all-events fetch fails on mount, show an error state with retry button instead of a blank panel. Set `loading` to false and `error` to the error message.

---

## Step 3: Shadowing Synthesis (spec 6.3)

**Goal:** AI synthesis that aggregates SYSTEM event detail notes into `SystemEntry.detailNotes`, using a shadowing-specific prompt.

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/ai/prompts/shadowing-synthesis.ts` | Prompt builder for shadowing sessions |
| `src/__tests__/api/sessions-synthesize-shadowing.test.ts` | Shadowing-specific synthesis tests |

### Files to MODIFY

| File | Change |
|------|--------|
| `src/lib/ai/schemas/synthesis.ts` | Add `detailNotes` field to system schema |
| `src/lib/ai/context.ts` | Extend `SessionContext` with events, debriefAnswers, notes |
| `src/app/api/sessions/[sessionId]/synthesize/route.ts` | Branch on session type; require debriefAnswers for shadowing |

### Schema change (`synthesis.ts`)

Add `detailNotes` to the system object within the synthesis schema. Find the exact schema name and line from Step 0 binding table (#8).

```typescript
// Add to the system object schema (wherever synthesisSystemSchema or equivalent is defined):
detailNotes: z.string().optional().describe(
  'Aggregated detail notes: column mappings, sheet names, data flows between systems. Combine ALL SYSTEM event detail fields for this system into one comprehensive string.'
),
```

This is backward-compatible: non-shadowing synthesis won't produce it, and `optional()` means existing stored outputs still parse.

### Context extension (`context.ts`)

Add these fields to the `SessionContext` type:

```typescript
// Add to SessionContext interface:
events?: Array<{
  type: string;
  label: string | null;
  detail: string | null;
  timestamp: string;
}>;
debriefAnswers?: DebriefAnswers | null;
notes?: string | null;
```

In `buildSessionContext()`, add a branch for shadowing sessions. **Important:** Check Step 0 #11 to confirm `SessionContext` is an interface (add fields) vs. a type alias (may need different approach). Check Step 0 #21 to determine whether events are pre-loaded.

```typescript
if (session.type === 'shadowing') {
  // Check Step 0 #21: if getSessionWithFullContext already loads eventLogs,
  // use those instead of making a separate query.
  // Option A — events already loaded on session object:
  //   ctx.events = session.eventLogs.map(e => ({ ... }));
  // Option B — events NOT pre-loaded, need separate query:
  //   const events = await getEventsBySessionId(sessionId);
  //   ctx.events = events.map(e => ({ ... }));
  //
  // The junior MUST check Step 0 #21 to determine which option applies.
  // Based on known codebase: getSessionWithFullContext DOES load eventLogs.
  // So prefer Option A to avoid a redundant DB query.

  ctx.events = (session.eventLogs ?? []).map((e: any) => ({
    type: e.type,
    label: e.label,
    detail: e.detail,
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
  }));
  ctx.debriefAnswers = session.debriefAnswers as DebriefAnswers | null;
  ctx.notes = session.notes ?? null; // FDE's personal notes from capture
}
```

**Important:** Non-shadowing sessions do NOT get events loaded — no change to existing behavior.

### Shadowing prompt (`shadowing-synthesis.ts`)

```typescript
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

  return `You are analyzing a shadowing session for the FDE Discovery Tool.

## Context

Client: ${ctx.client.name}, ${ctx.client.industry}
Process: ${ctx.process.name} — ${ctx.process.hypothesisText ?? 'No hypothesis'}
Current ProcessModel: ${JSON.stringify(ctx.processModel)}
Domain knowledge (L1): ${JSON.stringify(ctx.l1)}
Interview answers (session goals): ${JSON.stringify(ctx.session.interviewAnswers)}

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

## Instructions

Produce a structured synthesis with these sections:

1. **summary**: One paragraph session summary.

2. **steps**: Updated process steps array. Mark as 'confirmed' if directly observed (logged as STEP). Keep 'inferred' if not observed but still believed to exist. Mark 'missing' if the full flow was observed and this step was skipped. Include insights from debrief answers.

3. **edgeCases**: From EDGE events + described IMPLICIT events. Include frequency estimate and suggested handling.

4. **systems**: From SYSTEM events. For each system:
   - name, confirmed (true if observed), role, details, gaps
   - **detailNotes**: CRITICAL — aggregate ALL detail fields from SYSTEM events for this system into one comprehensive string. This captures column names, sheet names, data mappings, data flows. Example: if "Excel" was logged 3 times with notes "Col A = Supplier", "Sheet: Quotes2024", "data from email body", combine into: "Sheet: Quotes2024\\nCol A = Supplier Name\\nData source: email body"

5. **openQuestions**: From unresolved debrief items, missing steps, unconfirmed systems. With priority.`;
}
```

### Route modification (`synthesize/route.ts`)

**Important:** Check Step 0 #26 for the exact structure of the existing synthesize route. The junior must wrap the existing `generateObject` call in an `else` block to create the session-type branch. The modification below shows the shadowing branch that goes BEFORE the existing code:

```typescript
// After: const ctx = await buildSessionContext(sessionId);

if (ctx.session.type === 'shadowing') {
  // Shadowing sessions MUST have completed debrief
  if (ctx.debriefAnswers === null || ctx.debriefAnswers === undefined) {
    return NextResponse.json(
      { error: 'Complete the debrief before running synthesis on shadowing sessions.' },
      { status: 400 }
    );
  }

  try {
    const { model } = await getAIConfig('synthesis');
    const prompt = buildShadowingSynthesisPrompt(ctx);

    const { object } = await generateObject({
      model,
      schema: synthesisSchema, // same schema, now with optional detailNotes on systems
      maxTokens: 4000, // higher than non-shadowing (3000) due to more context
      system: 'You are an expert process analyst. Analyze a shadowing session and produce structured updates to the process model.',
      prompt,
    });

    await updateSession(sessionId, {
      synthesisOutput: object,
      aiSummary: object.summary.slice(0, 200),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Shadowing synthesis failed:', error);
    // Do NOT update session — leave synthesisOutput as null so user can retry
    return NextResponse.json(
      { error: 'Synthesis failed. Please try again.' },
      { status: 500 }
    );
  }
}

// ... existing non-shadowing synthesis logic (unchanged — now inside implicit else)
```

**Import additions to the synthesize route file:**

```typescript
import { buildShadowingSynthesisPrompt } from '@/lib/ai/prompts/shadowing-synthesis';
```

### Test plan (12 tests, written first)

```
describe('POST /api/sessions/[sessionId]/synthesize — shadowing')
  1. returns 400 when shadowing session has no debriefAnswers
  2. returns 400 when shadowing session has status !== 'completed'
  3. calls generateObject with shadowing prompt (mock generateObject, verify prompt string includes 'System Events Grouped')
  4. calls generateObject with shadowing prompt that includes events array
  5. calls generateObject with shadowing prompt that includes debriefAnswers
  6. calls generateObject with shadowing prompt that includes notes field
  7. saves synthesis output with detailNotes on systems
  8. non-shadowing session still uses original prompt (verify prompt does NOT include 'System Events Grouped')
  9. returns 500 when generateObject throws (does NOT update session)
  10. returns 500 when generateObject throws (session.synthesisOutput remains null)

describe('buildSessionContext — shadowing branch')
  11. includes events array for shadowing sessions
  12. does NOT include events for non-shadowing sessions

describe('buildShadowingSynthesisPrompt')
  13. groups SYSTEM events by label as system name
  14. excludes null/empty details from grouped system events
  15. handles sessions with zero SYSTEM events (empty systemEvents object)
```

### Risks

- **Token limits:** Large event logs (100+ events) could approach context limits. Mitigation: include all for v1. If token errors occur, add truncation (keep last 80 events + all SYSTEM events). Document this as a known v2 improvement.
- **AI SDK maxTokens:** Set to 4000 for shadowing synthesis (more context = more output expected). Non-shadowing stays at existing value.
- **generateObject failure:** Wrapped in try/catch. On error, return 500 with descriptive message. Do NOT update session — leave `synthesisOutput` as null so user can retry. Tests 9-10 verify this explicitly.
- **Context builder redundant query:** `getSessionWithFullContext` already loads `eventLogs` (verify Step 0 #21). The context builder should use the pre-loaded events, NOT call `getEventsBySessionId` again. This avoids a redundant DB round-trip.
- **Route restructuring risk:** The junior must be careful when wrapping existing synthesis code in an `else` block. The entire existing block should be indented inside `else { ... }` without modifying any of its logic. Run `npm run build` immediately after this change to catch syntax errors before writing tests.

---

## Step 4: Apply Changes — detailNotes Merge (spec 6.4)

**Goal:** `mergeSystems()` appends `detailNotes` instead of replacing.

### Prerequisite check

Before modifying merge logic, verify that `SystemEntry` in `types.ts` has the `detailNotes` field (Step 0 #7).

**If `detailNotes` is missing from `SystemEntry`:** Add it to `src/lib/db/types.ts` as part of this step:

```typescript
// Add to SystemEntry interface:
detailNotes?: string;
```

This is listed under "Files NOT to touch" in the assumptions section, but this fallback overrides that assumption if the field doesn't exist. The junior should verify and act accordingly.

### Files to MODIFY

| File | Change |
|------|--------|
| `src/lib/db/types.ts` | Add `detailNotes?: string` to `SystemEntry` IF missing (Step 0 #7) |
| `src/lib/utils/merge-process-model.ts` | Update `mergeSystems()` to handle `detailNotes` |
| `src/__tests__/utils/merge-process-model.test.ts` | Add detailNotes tests |

### Merge logic change

Find `mergeSystems()` using Step 0 binding table (#10, expected around lines 100-140). Two changes:

**1. New systems (when system name not found in existing):**

```typescript
// Add detailNotes when inserting a new system
{
  ...sys,
  detailNotes: sys.detailNotes ?? '',
}
```

**2. Modified systems (when system name already exists):**

```typescript
// Append detailNotes with separator instead of replacing
{
  ...current,
  confirmed: current.confirmed || sys.confirmed,
  role: sys.role || current.role,
  details: [current.details, sys.details].filter(Boolean).join('; '),
  gaps: [current.gaps, sys.gaps].filter(Boolean).join('; '),
  detailNotes: [current.detailNotes, sys.detailNotes]
    .filter(Boolean)
    .join('\n---\n') || '',
  sourceSessionId: sys.sourceSessionId || current.sourceSessionId,
}
```

The `\n---\n` separator visually delineates notes from different sessions. The `filter(Boolean)` prevents leading separators when one side is empty.

### Test plan (5 new tests, written first)

```
describe('mergeSystems — detailNotes')
  1. new system includes detailNotes from synthesis output
  2. new system without detailNotes gets empty string default
  3. modified system appends detailNotes with '\n---\n' separator
  4. modified system with empty existing detailNotes uses new value directly (no leading separator)
  5. modified system with no new detailNotes preserves existing unchanged
```

### No changes needed to apply-synthesis route

The route at `src/app/api/sessions/[sessionId]/apply-synthesis/route.ts` already calls `mergeSystems()` and passes the result through. The `detailNotes` field flows through automatically because it's part of the system object. **Verify this claim in Step 0 binding table #24** — check that the apply route doesn't destructure or filter system fields. If it does, add `detailNotes` to the allowed/spread fields.

### Risks

- Minimal — pure function change with clear unit tests.
- The `SystemEntry` type check (Step 0 #7) is critical. If the type is missing `detailNotes`, TypeScript will error on every access. This must be resolved before running tests.

---

## Step 5: Synthesis Display — Show detailNotes (spec 6.5)

**Goal:** Systems panel in synthesis display renders `detailNotes` in a monospace block.

### Files to MODIFY

| File | Change |
|------|--------|
| `src/components/sessions/synthesis-panels.tsx` | Render `detailNotes` in Systems section |

### Display change

Find the Systems section in `synthesis-panels.tsx` (use Step 0 binding table #18). After the existing role/details/gaps display for each system, add:

```tsx
{sys.detailNotes && (
  <div className="mt-2">
    <p className="text-xs font-medium text-muted-foreground mb-1">Detail Notes</p>
    <div className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap">
      {sys.detailNotes}
    </div>
  </div>
)}
```

The `font-mono whitespace-pre-wrap` preserves the column listing format and `\n---\n` separators between sessions. The label "Detail Notes" gives the FDE context for what this block contains.

### Tests

No separate tests — purely visual, additive change. The `detailNotes` field is already typed as optional string on `SystemEntry` (verified or added in Step 4).

### Risks

- None — additive display change that only renders when `detailNotes` is truthy.

---

## Prerequisite Assumptions & Fallbacks

These files are assumed to already have the necessary schema/types/queries from prior phases. **Every assumption must be verified in Step 0 binding table.** If any assumption fails, the fallback instructions create the missing piece in the correct step.

| File | Assumption | Step 0 verification | Fallback if wrong |
|------|-----------|---------------------|--------------------|
| `src/lib/db/schema.ts` | `debriefAnswers` column already exists (JSONB) | #1 confirms column exists | **BLOCKER** — requires migration. Stop and create migration first. |
| `src/lib/db/types.ts` — `DebriefItem` | Already fully defined | #4 confirms | Create in Step 1 before writing validation schema. See definition below. |
| `src/lib/db/types.ts` — `DebriefAnswers` | Already fully defined | #5 confirms | Create in Step 1 before writing validation schema. See definition below. |
| `src/lib/db/types.ts` — `SystemEntry.detailNotes` | Already has `detailNotes?: string` | #7 confirms | Add in Step 4 as prerequisite. |
| `src/lib/db/queries/events.ts` — `getDebriefEvents()` | Already exists | #3 confirms | Create before Step 1. See implementation below. |
| `src/app/api/sessions/[sessionId]/apply-synthesis/route.ts` | Delegates to `mergeSystems()` without filtering fields | #24 confirms | Add `detailNotes` to allowed fields in Step 4. |

### Fallback: `getDebriefEvents` (if missing)

Create in `src/lib/db/queries/events.ts` before Step 1:

```typescript
export async function getDebriefEvents(sessionId: string) {
  return db.select().from(eventLogs)
    .where(and(
      eq(eventLogs.sessionId, sessionId),
      or(
        eq(eventLogs.type, 'QUESTION'),
        and(eq(eventLogs.type, 'IMPLICIT'), isNull(eventLogs.label))
      )
    ))
    .orderBy(eventLogs.timestamp);
}
```

### Fallback: `DebriefItem` and `DebriefAnswers` types (if missing)

Add to `src/lib/db/types.ts`:

```typescript
export interface DebriefItem {
  eventLogId: string;
  type: 'question' | 'implicit';
  resolution: 'asked_answered' | 'described' | 'open_question' | 'skipped';
  answer?: string;
  description?: string;
  priority?: 'critical' | 'important' | 'nice_to_have';
  openQuestionId?: string;
}

export interface DebriefAnswers {
  items: DebriefItem[];
}
```

---

## Verification Plan

After all steps are complete:

**1. Automated tests:**

```bash
npx vitest run
```

All existing + new tests pass. Expected new test count: ~35.

**2. Type check:**

```bash
npm run build
```

No TypeScript errors.

**3. Manual flow test (requires running app):**

| # | Action | Expected |
|---|--------|----------|
| 1 | Open a shadowing session that has completed capture (status: `completed`) | Session overview shows debrief panel |
| 2 | If no QUESTION/IMPLICIT events exist | Debrief auto-skips, synthesis button appears |
| 3 | Start debrief → resolve each event → click "Save Debrief" | Debrief saved, panel replaced with summary badge |
| 4 | Verify open questions created for `open_question` resolution items | Open questions appear on process overview |
| 5 | Verify IMPLICIT events resolved as 'described' have their label updated | Event list shows the new label |
| 6 | Click "Run Synthesis" | Synthesis runs with shadowing prompt |
| 7 | Verify synthesis output shows `detailNotes` on systems | Monospace block visible in Systems panel |
| 8 | Click "Apply Changes" | Process model updated, detailNotes preserved |
| 9 | Run synthesis on a non-shadowing session | Original prompt used, no detailNotes expected |
| 10 | Verify snapshot was created before apply | Check processModelSnapshots table |
| 11 | Navigate away mid-debrief (with answers entered) | Browser shows "unsaved changes" warning |
| 12 | Submit debrief with an invalid eventLogId (via API tool) | Returns 400 with clear error |
| 13 | Submit debrief with duplicate eventLogIds (via API tool) | Returns 400 with 'Duplicate eventLogId' error |
| 14 | Submit debrief with `asked_answered` on implicit event (via API tool) | Returns 400 with field-level error on resolution |
| 15 | Attempt synthesis on shadowing session without completing debrief first | Returns 400 with 'Complete the debrief' message |

**4. Update SPEC.md:**

Mark 6.1–6.5 as `[x]`, update current state section.

---

## Summary

| Step | Spec | Tests | Files Create | Files Modify |
|------|------|-------|--------------|--------------|
| 0 | Binding Table | 0 | 0 | 0 |
| 1 | 6.2 Debrief API | 22 | 3 | 1 |
| 2 | 6.1 Debrief Page | 0 (UI) | 1 | 1 |
| 3 | 6.3 Shadowing Synthesis | 15 | 2 | 3 |
| 4 | 6.4 Apply detailNotes | 5 | 0 | 2–3 (types.ts if fallback) |
| 5 | 6.5 Display detailNotes | 0 (UI) | 0 | 1 |
| **Total** | | **42** | **6** | **8–9** |