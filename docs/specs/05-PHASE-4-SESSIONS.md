# Phase 4 — Session Lifecycle (Non-Shadowing)

**Goal:** Full session flow with transcript+notes capture, per-user AI for interview and synthesis.
**Duration:** 4 days
**Gate:** Create any session type, AI interview works, transcript+notes save, synthesis runs.

---

## Key Changes from v1

1. **Transcript + Notes:** Session Detail shows TWO textareas — one for pasted transcript, one for personal notes. Both feed into synthesis. Both auto-save on blur.
2. **Per-user AI:** Interview questions and prep brief use `getAIConfig('interview')`. Synthesis uses `getAIConfig('synthesis')`.
3. **After any session ends:** User sees transcript + notes area before synthesis, regardless of session type.

---

## Step 4.1 — Session Creation (Type Selector + Fields + Interview)

Same multi-step flow as v1. The interview API route now uses the user's config:

### Interview API Route: `src/app/api/sessions/interview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { model } = await getAIConfig('interview');
    const { sessionType, fieldData, processId, previousQA } = await req.json();

    // Build context (same as v1)...

    const { text } = await generateText({
      model,  // User's preferred interview model
      maxTokens: 300,
      system: `You are helping a Forward Deployed Engineer prepare for a ${sessionType} session...`,
      prompt: `...`, // Same prompt as v1
    });

    return NextResponse.json({ question: text.trim(), isLast, questionNumber });
  } catch (error) {
    return handleAPIError(error);  // Handles NO_API_KEY → 422
  }
}
```

---

## Step 4.2 — Prep Brief with User's Config

```typescript
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';

export async function generatePrepBrief(session: any, processId: string) {
  const { model } = await getAIConfig('interview');  // Same model as interview
  const { object } = await generateObject({ model, schema: prepBriefSchema, ... });
  return object;
}
```

---

## Step 4.3 — Session Detail with Transcript + Notes

### Component: `src/app/(dashboard)/.../sessions/[sessionId]/page.tsx`

The key UI change: **two separate text areas** below the prep brief.

```tsx
{/* Transcript + Notes Section — always visible */}
<div className="grid gap-4 md:grid-cols-2">
  {/* Transcript */}
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      Transcript
      <span className="text-muted-foreground font-normal ml-1">(paste from Granola or other tool)</span>
    </Label>
    <Textarea
      value={transcript}
      onChange={(e) => setTranscript(e.target.value)}
      onBlur={() => handleSaveField('transcriptText', transcript)}
      placeholder="Paste your session transcript here..."
      className="min-h-[200px] font-mono text-sm"
    />
    <p className="text-xs text-muted-foreground">Auto-saves when you click away</p>
  </div>

  {/* Notes */}
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      Notes
      <span className="text-muted-foreground font-normal ml-1">(your observations and thoughts)</span>
    </Label>
    <Textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => handleSaveField('notes', notes)}
      placeholder="Write your own notes here — observations, questions, things to follow up on..."
      className="min-h-[200px]"
    />
    <p className="text-xs text-muted-foreground">Auto-saves when you click away</p>
  </div>
</div>
```

### Auto-save handler:

```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout>();

function handleSaveField(field: 'transcriptText' | 'notes', value: string) {
  clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(async () => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    toast.success('Saved', { duration: 1000 });
  }, 2000); // 2 second debounce
}
```

---

## Step 4.4 — "Mark Completed" Flow

For non-shadowing sessions, when user clicks "Mark as Completed":

1. If both transcript AND notes are empty: show warning "No transcript or notes. Are you sure?"
2. Update session status to `completed`
3. Show "Run Synthesis" button

For shadowing sessions: "Start Capture" button leads to capture page (Phase 5). After capture ends, user is taken to a **post-capture screen** where they can paste transcript + add notes BEFORE the debrief.

---

## Step 4.5 — Non-Shadowing Synthesis

### `src/app/api/sessions/[sessionId]/synthesize/route.ts`

```typescript
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';

export async function POST(req: NextRequest, { params }) {
  try {
    await requireAdmin();
    const { model } = await getAIConfig('synthesis');
    const { sessionId } = await params;

    const session = await getSessionWithFullContext(sessionId);

    // Check that we have SOMETHING to analyze
    if (!session.transcriptText && !session.notes) {
      return NextResponse.json(
        { error: 'No transcript or notes to analyze. Add content before running synthesis.' },
        { status: 400 }
      );
    }

    const { object } = await generateObject({
      model,
      schema: nonShadowingSynthesisSchema,
      maxTokens: 3000,
      system: `Analyze a ${session.type} session.`,
      prompt: `...
Transcript: ${session.transcriptText ?? 'No transcript provided'}
Notes: ${session.notes ?? 'No notes provided'}
...`,  // Both transcript AND notes included in prompt
    });

    await updateSession(sessionId, {
      synthesisOutput: object,
      aiSummary: object.summary.slice(0, 200),
    });

    return NextResponse.json(object);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

> **Note:** Synthesis prompt now includes BOTH `transcriptText` AND `notes`. The AI is told: "You have the session transcript (pasted from a recording tool) and the FDE's personal notes. Use both to produce your analysis."

---

## Step 4.6 — Synthesis Display

Same as v1 — collapsible panels showing suggested updates, new questions, discovered entities. Each with "Apply" actions.

---

## Phase 4 Gate Checklist

- [ ] Session type selector renders 5 cards
- [ ] Structured fields change per session type
- [ ] AI interview uses user's API key and `interview` model preference
- [ ] If no API key: "Skip interview" is the only option (with message)
- [ ] Session created with all data
- [ ] Prep brief generates with user's config
- [ ] **Transcript textarea saves on blur (2s debounce)**
- [ ] **Notes textarea saves on blur (2s debounce)**
- [ ] **Both transcript and notes display on Session Detail**
- [ ] "Mark completed" warns if both empty
- [ ] Synthesis runs using user's `synthesis` model preference
- [ ] Synthesis prompt includes both transcript AND notes
- [ ] "Apply selected" updates ProcessModel with snapshot
