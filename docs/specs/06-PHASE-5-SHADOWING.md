# Phase 5 — Shadowing Live Capture

**Goal:** Full-screen capture with system detail notes, post-capture transcript+notes screen, per-user AI suggestions.
**Duration:** 4 days
**Gate:** Complete capture session, system notes captured, transcript+notes added post-capture.

---

## Overview

1. **SYSTEM button → pick system → optional detail notes**: After selecting a system (e.g., "Excel"), a text field appears asking "Any details? (columns, sheets, mappings)". This is where the FDE captures things like "Column A = Supplier, Sheet: Quotes2024". The notes are stored on the event AND flow into the SystemEntry's `detailNotes` during synthesis.
2. **Post-capture screen**: After "End Session", before debrief, user sees a screen to paste transcript + write notes. This is critical because the FDE often records audio during shadowing and pastes the transcript after.
3. **Suggestions use user's `suggestions` model** (typically Haiku for speed + cost).

---

## Step 5.1 — Capture Page

Full-screen layout, 65/35 split between event log and capture buttons. Five capture buttons stacked vertically.

### SYSTEM Button — Enhanced Flow

When user taps SYSTEM, the flow is now:

1. Show 8-button grid (Email, Excel, SharePoint, SAP, ERP, Browser, Phone, Other)
2. One tap → logs the SYSTEM event
3. **NEW:** After logging, an optional detail notes field slides up:

```tsx
// In SystemPicker component — after system selection
export function SystemPicker({ onSelect, onDismiss }) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [detailNotes, setDetailNotes] = useState('');

  function handleSystemTap(system: string) {
    setSelectedSystem(system);
    // Show detail notes field
  }

  function handleConfirm() {
    onSelect(selectedSystem!, detailNotes || undefined);
    setSelectedSystem(null);
    setDetailNotes('');
  }

  if (selectedSystem) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4">
        <div className="fixed inset-0 -z-10" onClick={() => {
          onSelect(selectedSystem, undefined); // Submit without notes
        }} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge>{selectedSystem}</Badge>
            <span className="text-sm text-muted-foreground">logged</span>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">
              Any details? <span className="text-muted-foreground">(columns, sheets, mappings — optional)</span>
            </Label>
            <Textarea
              value={detailNotes}
              onChange={(e) => setDetailNotes(e.target.value)}
              placeholder="e.g. Sheet: Quotes2024, Col A=Supplier, Col B=Price. Data from email body."
              className="min-h-[60px] text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirm}>
              {detailNotes ? 'Save with notes' : 'Skip notes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // System grid (8 buttons in 2x4 layout)
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4">
      <div className="fixed inset-0 -z-10" onClick={onDismiss} />
      <div className="grid grid-cols-4 gap-2">
        {SYSTEMS.map((sys) => (
          <button key={sys} onClick={() => handleSystemTap(sys)}
            className="h-14 rounded-lg border hover:bg-muted font-medium">
            {sys}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Event Log Entry for SYSTEM — Shows Notes

```tsx
// In EventLogPanel, for SYSTEM events:
<div className="flex items-start gap-2">
  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
  <div>
    <span className="text-sm">{event.label}</span>
    {event.detail && (
      <p className="text-xs text-muted-foreground mt-0.5 italic">{event.detail}</p>
    )}
  </div>
</div>
```

The `detail` field on the EventLog stores the system detail notes. During synthesis, these are aggregated into the SystemEntry's `detailNotes`.

### Updated addEvent for SYSTEM

```typescript
// In capture page
function handleSystemSelect(systemName: string, detailNotes?: string) {
  const event: LocalEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: 'SYSTEM',
    label: systemName,
    detail: detailNotes || null,  // Store detail notes on the event
    suggestionUsed: false,
    synced: false,
  };
  setEvents((prev) => [...prev, event]);
  // Also auto-create OpenQuestion
  // "Confirm role of [System] in this process."
}
```

---

## Step 5.2 — Suggestions with User's Model

### `src/app/api/ai/suggestions/route.ts`

```typescript
import { generateObject } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { z } from 'zod';

const cache = new Map<string, { suggestions: string[]; timestamp: number }>();

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { model } = await getAIConfig('suggestions');  // Typically Haiku for speed
    const { sessionId, eventCount, type } = await req.json();

    // Check cache (30s TTL)
    const cacheKey = `${sessionId}:${eventCount}:${type}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return NextResponse.json({ suggestions: cached.suggestions });
    }

    const events = await getEventsBySessionId(sessionId);
    const session = await getSessionWithProcessContext(sessionId);
    const l1 = getL1(session.process.processTypeL1);

    const { object } = await generateObject({
      model,  // User's suggestions model (Haiku = fast + cheap)
      schema: z.object({
        suggestions: z.array(z.string().describe('2-6 word action description')).max(5),
      }),
      maxTokens: 200,
      system: `Generate 4-5 suggestion chips for the next likely ${type} in this process.`,
      prompt: `Process type: ${l1.process_type}
Typical steps: ${JSON.stringify(l1.typical_steps?.slice(0, 8))}
Events so far: ${JSON.stringify(events.map((e) => ({ type: e.type, label: e.label })))}
Session focus: ${JSON.stringify(session.interviewAnswers)}
Button: ${type}

${type === 'EDGE' ? 'Suggest exceptions/variations.' : 'Suggest next likely steps.'}`,
    });

    cache.set(cacheKey, { suggestions: object.suggestions, timestamp: Date.now() });
    return NextResponse.json(object);
  } catch (error) {
    // If no API key, return empty suggestions (don't crash capture)
    if (error instanceof Error && error.message === 'NO_API_KEY') {
      return NextResponse.json({ suggestions: [] });
    }
    return handleAPIError(error);
  }
}
```

> **Important:** If the user has no API key, suggestions silently return empty. The text field still works. Never crash the capture UI.

---

## Step 5.3 — Post-Capture Screen (NEW)

After "End Session" confirmation, BEFORE navigating to debrief, the user sees a screen to add transcript and notes.

### Flow:

```
Capture → "End Session" → Confirm → Post-Capture (transcript + notes) → Debrief
```

### Component: `src/components/sessions/post-capture-screen.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PostCaptureScreenProps {
  sessionId: string;
  eventCount: number;
  onContinue: () => void;
}

export function PostCaptureScreen({ sessionId, eventCount, onContinue }: PostCaptureScreenProps) {
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSaveAndContinue() {
    setSaving(true);
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcriptText: transcript || null,
        notes: notes || null,
        status: 'completed',
      }),
    });
    setSaving(false);
    onContinue();
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Session Captured</h1>
        <p className="text-muted-foreground mt-1">
          {eventCount} events logged. Add your transcript and notes before reviewing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste Transcript</CardTitle>
          <CardDescription>
            If you recorded the session with Granola or another tool, paste the transcript here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste transcript here..."
            className="min-h-[150px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Notes</CardTitle>
          <CardDescription>
            Write anything you observed that wasn't captured by the buttons —
            context, impressions, things you want to remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Your notes and observations..."
            className="min-h-[150px]"
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSaveAndContinue} disabled={saving}>
          {saving ? 'Saving...' : 'Continue to Debrief'}
        </Button>
        <Button variant="ghost" onClick={onContinue}>
          Skip — go to debrief
        </Button>
      </div>
    </div>
  );
}
```

### Integration in Capture Page

After "End Session" confirm dialog:

```typescript
async function handleEndSession() {
  setShowPostCapture(true);  // Show post-capture screen instead of navigating immediately
}

// In render:
{showPostCapture ? (
  <PostCaptureScreen
    sessionId={sessionId}
    eventCount={events.length}
    onContinue={() => {
      router.push(`/clients/${clientId}/processes/${processId}/sessions/${sessionId}/debrief`);
    }}
  />
) : (
  // Normal capture UI
)}
```

---

## Steps 5.4–5.5 — Event Log, Offline, Buttons

Event log panel, offline indicator, and page unload warning are described in the capture page component above.

---

## Phase 5 Gate Checklist

- [ ] Full-screen capture works
- [ ] All 5 buttons log events
- [ ] STEP/EDGE show suggestion chips (using user's `suggestions` model)
- [ ] If no API key: suggestions empty, text field works
- [ ] **SYSTEM button shows system grid → optional detail notes field**
- [ ] **System detail notes stored in event.detail**
- [ ] IMPLICIT and QUESTION log instantly with inline label
- [ ] "End Session" → **post-capture screen** (transcript + notes)
- [ ] Post-capture saves transcript and notes
- [ ] "Skip" option goes directly to debrief
- [ ] Offline indicator + queue + sync
- [ ] **Test on iPad** — all buttons 64px+, touch targets 48px+
