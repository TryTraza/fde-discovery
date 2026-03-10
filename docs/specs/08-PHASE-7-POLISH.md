# Phase 7 — AI Research Panel + Polish

**Goal:** Research panel with web search (user's key), email drafts, artifacts, viewer role, final polish.
**Duration:** 3 days
**Gate:** Full app usable end-to-end. Viewer can browse but not edit. AI works with user's keys.

---

## Step 7.1 — AI Research Panel with User's Key

The research panel uses `useChat` for streaming. The API route reads the user's key.

### API Route: `src/app/api/ai/research/route.ts`

```typescript
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { currentUser } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/auth/utils';
import { getClientById } from '@/lib/db/queries/clients';
import { getProcessById } from '@/lib/db/queries/processes';
import { getL1 } from '@/lib/domain/l1';
import { createResearchNote } from '@/lib/db/queries/research-notes';

export const maxDuration = 30;

export async function POST(req: Request) {
  await requireAdmin();

  // Get user's API key
  const user = await currentUser();
  const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured. Go to Settings.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const modelPrefs = (user?.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs.research || 'claude-sonnet-4-20250514';

  // Create per-request Anthropic provider
  const anthropic = createAnthropic({ apiKey });

  const { messages, clientId, processId }: {
    messages: UIMessage[];
    clientId?: string;
    processId?: string;
  } = await req.json();

  // Build context
  let context = '';
  if (clientId) {
    const client = await getClientById(clientId);
    if (client) context += `Client: ${client.name}, ${client.industry}. ${client.aiSummary ?? ''}\n`;
  }
  if (processId) {
    const process = await getProcessById(processId);
    if (process) {
      const l1 = getL1(process.processTypeL1);
      context += `Process: ${process.name}. ${process.hypothesisText ?? ''}\n`;
      context += `Domain knowledge: ${JSON.stringify(l1)}\n`;
    }
  }

  const result = streamText({
    model: anthropic(modelId),
    messages: await convertToModelMessages(messages),
    tools: {
      web_search: anthropic.tools.webSearch_20250305(),
    },
    maxSteps: 5,
    system: `You are a research assistant for a Forward Deployed Engineer at Traza AI. Help them research and understand client companies, industry patterns, operational processes, and system documentation.

Current context:
${context}

Stay focused on FDE research. Be specific and actionable. Flag information that contradicts the current ProcessModel. Keep responses to 1-3 paragraphs unless asked for depth.`,
    onFinish: async ({ text }) => {
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage && clientId) {
        await createResearchNote({
          clientId,
          processId: processId ?? null,
          query: typeof lastUserMessage.content === 'string'
            ? lastUserMessage.content : 'Research query',
          response: text,
          sources: [],
        }).catch(console.error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

> **Key patterns:**
> - `createAnthropic({ apiKey })` creates a per-request provider with the user's key
> - `anthropic.tools.webSearch_20250305()` gives Claude web search — **no external API needed**
> - `maxSteps: 5` allows multi-step tool use (search → read → search again → respond)
> - `streamText` + `toUIMessageStreamResponse()` handles streaming to `useChat` on the client

### Client Component

Uses AI Elements for the chat UI with an error state for missing API key:

```tsx
// In AIResearchPanel component
const { messages, sendMessage, status, error } = useChat({
  api: '/api/ai/research',
  body: { clientId, processId },
});

// Show API key guard if error is 422
if (error?.message?.includes('422')) {
  return <APIKeyGuard>{/* empty */}</APIKeyGuard>;
}
```

---

## Step 7.2 — Follow-Up Email Draft

```typescript
import { generateText } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';

export async function POST(req: NextRequest, { params }) {
  try {
    await requireAdmin();
    const { model } = await getAIConfig('research');  // Use research model for email
    // Full prompt defined in 09-TECH-REFERENCE.md
  } catch (error) {
    return handleAPIError(error);
  }
}
```

---

## Step 7.3 — Artifact Upload

Uses Supabase Storage for files. No AI interaction needed, so no API key required.

---

## Step 7.4 — Viewer Role Enforcement

### Frontend: Conditional UI

```typescript
// src/lib/hooks/use-role.ts
'use client';
import { useUser } from '@clerk/nextjs';

export function useRole() {
  const { user } = useUser();
  const meta = user?.publicMetadata as any;
  return {
    role: meta?.role ?? 'viewer',
    isAdmin: meta?.role === 'admin',
    isViewer: meta?.role !== 'admin',
    hasApiKey: !!meta?.hasApiKey,
  };
}
```

Wrap all write actions + AI features behind `isAdmin`. AI features additionally check `hasApiKey`.

### Backend: Already enforced

All write routes call `requireAdmin()`. AI routes throw `NO_API_KEY` → 422 if key missing.

---

## Step 7.5 — Settings Page Enhancements

Add a "Test API Key" button that makes a minimal Claude call to verify the key works:

```tsx
async function handleTestKey() {
  setTesting(true);
  try {
    const res = await fetch('/api/settings/test-key', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      toast.success(`Key works! Model: ${data.model}`);
    } else {
      toast.error(`Key failed: ${data.error}`);
    }
  } catch {
    toast.error('Network error');
  } finally {
    setTesting(false);
  }
}
```

### Test Key Route: `src/app/api/settings/test-key/route.ts`

```typescript
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { currentUser } from '@clerk/nextjs/server';

export async function POST() {
  const user = await currentUser();
  const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) return NextResponse.json({ success: false, error: 'No key stored' });

  try {
    const anthropic = createAnthropic({ apiKey });
    const { text } = await generateText({
      model: anthropic('claude-haiku-3-5-20241022'),
      maxTokens: 10,
      prompt: 'Say "ok"',
    });
    return NextResponse.json({ success: true, model: 'claude-haiku-3.5' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
```

---

## Step 7.6 — Breadcrumb, Polish, Mobile

Polish items:
- [ ] Dynamic breadcrumb resolving UUIDs to entity names
- [ ] Loading skeletons everywhere
- [ ] Error boundaries with `error.tsx`
- [ ] Toast notifications (using `sonner`)
- [ ] Mobile: sidebar hamburger, full-screen capture, research panel full-screen
- [ ] Auto-save with debounce on transcript and notes
- [ ] Status transition constraints

---

## Phase 7 Gate Checklist

- [ ] AI Research panel streams responses with user's API key
- [ ] **Web search works in research panel** (Anthropic built-in tool)
- [ ] Research exchanges saved as ResearchNotes
- [ ] If no API key: research panel shows "Set key in Settings" message
- [ ] **"Test API Key" button on Settings page works**
- [ ] Follow-up email generates with user's key
- [ ] Artifact upload works (no key needed)
- [ ] Viewer role: browse only, no write, no AI
- [ ] **All AI features gracefully handle NO_API_KEY (422, not 500)**
- [ ] Breadcrumb works at all depths
- [ ] Mobile layout works
