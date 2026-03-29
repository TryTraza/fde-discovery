# Phase 7 — Research Panel + Polish — Implementation Plan

## Context

Phase 6 (Debrief + Synthesis) is complete with 399 tests passing. Phase 7 is the final phase:
it adds the AI research panel, follow-up email drafts, artifact uploads, viewer role
enforcement, and polish. Breadcrumb navigation (7.5) is already implemented and only needs
marking as done.

Decisions from Alberto:
- Research panel = Sheet (slide-out) from dashboard header, available on all pages
- Artifacts = No bucket yet — include Supabase bucket creation as setup step
- Email language = User-selectable (ES/EN toggle on the email draft card)

---

## Execution Order

| Order | Step | Description                                  | Est. Tests |
|-------|------|----------------------------------------------|------------|
| 1     | 7.0  | Dependency check + install + schema binding  | 0          |
| 2     | 7.5  | Mark breadcrumb as done (SPEC.md only)       | 0          |
| 3     | 7.1  | AI Research Panel (streaming + web search)   | ~10        |
| 4     | 7.2  | Follow-up email draft (with ES/EN toggle)    | ~8         |
| 5     | 7.3  | Artifact upload (Supabase Storage)           | ~10        |
| 6     | 7.4  | Viewer role enforcement                      | ~8         |
| 7     | 7.6  | Polish (error boundaries, skeletons, mobile) | ~4         |

---

## Step 7.0 — Dependency Check + Install + Schema Binding

Before writing any code, verify and install all dependencies this phase needs, AND resolve every schema column name to its actual value in the codebase.

### 7.0.1 — Verify existing packages

Run these commands and note what is missing:

```bash
# Check if @ai-sdk/react is installed (needed for useChat)
grep '"@ai-sdk/react"' package.json

# Check if @supabase/supabase-js is installed (needed for artifact storage)
grep '"@supabase/supabase-js"' package.json

# Check if react-markdown is installed (needed for research panel message rendering)
grep '"react-markdown"' package.json
```

### 7.0.2 — Install missing packages

```bash
# Install all that are missing:
npm install @ai-sdk/react @supabase/supabase-js react-markdown
```

Only install packages that are not already in package.json.

### 7.0.3 — Bind artifacts schema columns

The `artifacts` table has specific column names that **must** match the Drizzle schema exactly. Run:

```bash
grep -A 30 "export const artifacts" src/lib/db/schema.ts
```

**Expected columns (from the spec):**

| Schema Column       | Type    | Required | Notes                                    |
|---------------------|---------|----------|------------------------------------------|
| `id`                | uuid    | yes      | PK, auto-generated                       |
| `processId`         | uuid    | yes      | FK → processes                           |
| `sessionId`         | uuid    | no       | FK → sessions (null if uploaded from process view) |
| `filename`          | text    | yes      | Original filename — NOT `title`          |
| `storagePath`       | text    | yes      | Supabase Storage path — NOT `fileUrl`    |
| `fileSizeBytes`     | integer | yes      | Required — must be passed on create      |
| `mimeType`          | text    | yes      | MIME type — NOT `type`                   |
| `sourceDescription` | text    | no       | Free text                                |
| `label`             | text    | no       | Which process step this relates to       |
| `stage`             | enum    | no       | `artifactStageEnum`                      |
| `confirmed`         | boolean | yes      | Default false                            |
| `createdAt`         | timestamp | yes    | Auto                                     |
| `updatedAt`         | timestamp | yes    | Auto                                     |
| `deletedAt`         | timestamp | no     | Soft delete                              |

**CRITICAL:** The artifacts table has **NO** `createdBy` column, **NO** `title` column (use `filename`), **NO** `fileUrl` column (use `storagePath`), and **NO** `type` column (use `mimeType`).

Also verify the `artifactStageEnum` values:

```bash
grep -A 8 "artifactStageEnum" src/lib/db/schema.ts
```

**Expected values:** `'input'`, `'intermediate'`, `'output'`, `'reference'`. NOT `'discovery'`, `'validation'`, `'documentation'`. The UI component must use these exact enum values.

### 7.0.4 — Bind researchNotes schema columns

```bash
grep -A 15 "export const researchNotes" src/lib/db/schema.ts
```

**Expected columns:**

| Schema Column | Type    | Required | Notes                                           |
|---------------|---------|----------|-------------------------------------------------|
| `id`          | uuid    | yes      | PK                                              |
| `clientId`    | uuid    | no       | FK → clients (nullable)                         |
| `processId`   | uuid    | no       | FK → processes (nullable)                       |
| `query`       | text    | yes      | User's question                                 |
| `response`    | text    | yes      | AI response                                     |
| `sources`     | jsonb   | yes      | Default `[]`                                    |
| `createdAt`   | timestamp | yes    | Auto                                            |

**CRITICAL:** The `researchNotes` table has **NO** `createdBy` column and **NO** `deletedAt` column. The `createResearchNote` call must NOT pass `createdBy`.

### 7.0.5 — Verify existing query functions

```bash
# Check research-notes queries
grep -r "createResearchNote" src/lib/db/queries/

# Check artifact queries
grep -r "createArtifact\|listArtifactsByProcess\|softDeleteArtifact" src/lib/db/queries/
```

If `createResearchNote` does NOT exist, create it now:

CREATE: `src/lib/db/queries/research-notes.ts`

```typescript
import { eq, desc } from 'drizzle-orm';
import { db } from '../index';
import { researchNotes, type NewResearchNote } from '../schema';

export async function createResearchNote(data: NewResearchNote) {
  const [note] = await db.insert(researchNotes).values(data).returning();
  return note;
}

export async function listResearchNotesByProcess(processId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.processId, processId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}

export async function listResearchNotesByClient(clientId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.clientId, clientId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}
```

**Note:** `researchNotes` has no `deletedAt` column, so no soft-delete filter is needed.

### 7.0.6 — Verify useChat API surface

The AI SDK has changed its `useChat` API across versions. Before writing the client component, check which API is available:

```bash
# Check installed ai and @ai-sdk/react versions
cat node_modules/ai/package.json | grep '"version"'
cat node_modules/@ai-sdk/react/package.json | grep '"version"'

# Check useChat exports
grep -r "export.*useChat" node_modules/@ai-sdk/react/dist/ | head -5

# Check if useChat uses sendMessage, append, or handleSubmit
grep -r "sendMessage\|handleSubmit\|append" node_modules/@ai-sdk/react/dist/index.d.ts | head -10
```

Record the actual API shape. The plan below uses the CLAUDE.md convention (`sendMessage` + `status`). If the installed version uses different method names, substitute them throughout Step 7.1.3.

### 7.0.7 — Verify convertToModelMessages import path

```bash
# Check where convertToModelMessages is exported from
grep -r "convertToModelMessages" node_modules/ai/dist/ | head -5
grep -r "convertToModelMessages" node_modules/@ai-sdk/react/dist/ | head -5
grep -r "convertToModelMessages" node_modules/@ai-sdk/ui-utils/dist/ | head -5
```

Record which package exports it. The plan uses `import { convertToModelMessages } from 'ai'`. If your version exports it from a different package, substitute throughout Step 7.1.2.

### 7.0.8 — Verify getAIConfig and handleAPIError

```bash
# Check getAIConfig exists and its return shape
grep -A 20 "export.*getAIConfig" src/lib/ai/get-ai-config.ts

# Check handleAPIError exists
grep -A 10 "export.*handleAPIError" src/lib/auth/utils.ts

# Check what error type getAIConfig throws for missing API key
grep -r "NO_API_KEY\|ApiKeyError\|422" src/lib/ai/get-ai-config.ts
```

Record: Does `getAIConfig` throw a typed error that `handleAPIError` maps to 422? If not, the email draft route (7.2) needs an explicit API key check before calling `getAIConfig`.

### 7.0.9 — Verify existing route patterns for sessions and artifacts

```bash
# Check existing session API route paths
find src/app/api -name "route.ts" | grep -i session | head -10

# Check if any artifact routes already exist
find src/app/api -name "route.ts" | grep -i artifact | head -10

# Check the nesting pattern used in the codebase
find src/app/api -type d | head -20
```

Record the actual route nesting pattern. The plan will use whichever pattern the codebase already established.

### 7.0.10 — Verify getProcessById return shape

```bash
# Check what getProcessById returns — does it include client data?
grep -A 20 "export.*getProcessById" src/lib/db/queries/processes.ts
```

Record: Does it return `process.clientId` only, or does it join to include `client.name`? The email draft route (7.2) needs the client name. If `getProcessById` only returns `clientId`, the route must do a sequential `getClientById` fetch.

### 7.0.11 — Verify session synthesisOutput field name

```bash
# Check the actual column name for synthesis output on sessions
grep -A 30 "export const sessions" src/lib/db/schema.ts | grep -i synth
```

Record: Is it `synthesisOutput`, `synthesisResult`, or `synthesis_output`? The email draft (7.2) reads this field.

### 7.0.12 — Verify session status values

```bash
grep -A 8 "sessionStatusEnum" src/lib/db/schema.ts
```

Record: The exact status value that indicates synthesis is complete. The plan assumes `'synthesis_done'` but the enum might only have `'completed'`. If there's no `'synthesis_done'` status, the email draft guard must check `session.synthesisOutput !== null` instead.

---

## Step 7.5 — Breadcrumb (ALREADY DONE)

Action: Update SPEC.md only — mark 7.5 as `[x]`.

File: `SPEC.md`

---

## Step 7.1 — AI Research Panel

### 7.1.1 — Tests (RED)

CREATE: `src/__tests__/api/ai-research.test.ts`

Tests:

1. Returns 403 for viewer role
2. Returns 422 if no API key in user's `privateMetadata`
3. Calls `streamText` with correct model from user's `publicMetadata.aiModels.research`
4. Passes client context in system prompt when `clientId` provided in body
5. Passes process + L1 domain context in system prompt when `processId` provided in body
6. Calls `createResearchNote` in `onFinish` when `clientId` is present
7. Does NOT call `createResearchNote` when no `clientId` in body
8. Uses `maxSteps: 5` in `streamText` call
9. Includes `web_search` tool via `anthropic.tools.webSearch_20250305()` in `streamText` call
10. Falls back to `'claude-sonnet-4-20250514'` when no user model preference exists

Mock pattern — follow `src/__tests__/api/ai-suggestions.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock modules BEFORE imports
vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toUIMessageStreamResponse: () => new Response('ok'),
  }),
  convertToModelMessages: vi.fn().mockReturnValue([]),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(
    Object.assign(
      (modelId: string) => ({ modelId }),
      {
        tools: {
          webSearch_20250305: vi.fn().mockReturnValue({ type: 'web_search' }),
        },
      }
    )
  ),
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}));

vi.mock('@/lib/domain/l1', () => ({
  getL1: vi.fn().mockReturnValue({ name: 'procurement', steps: [] }),
}));

vi.mock('@/lib/db/queries/research-notes', () => ({
  createResearchNote: vi.fn().mockResolvedValue({ id: 'note-1' }),
}));

// requireAdmin mock — must throw for viewer, resolve for admin
vi.mock('@/lib/auth/utils', () => ({
  requireAdmin: vi.fn(),
}));
```

IMPORTANT: The test for "correct model" must verify that `streamText` was called with `model` matching the user's `publicMetadata.aiModels.research` preference. The test for "fallback model" must verify the default `'claude-sonnet-4-20250514'` is used when `aiModels` is missing or empty.

IMPORTANT: The `createResearchNote` mock must verify it is called WITHOUT a `createdBy` field — the `researchNotes` schema has no such column. The test should assert that `createResearchNote` was called with an object containing only `clientId`, `processId`, `query`, `response`, `sources`.

### 7.1.2 — API Route (GREEN)

CREATE: `src/app/api/ai/research/route.ts`

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

  // Pattern D: streaming requires direct provider access (cannot use getAIConfig)
  const user = await currentUser();
  const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured. Go to Settings.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const anthropic = createAnthropic({ apiKey });
  const modelPrefs = (user?.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs.research || 'claude-sonnet-4-20250514';

  const { messages, clientId, processId }: {
    messages: UIMessage[];
    clientId?: string;
    processId?: string;
  } = await req.json();

  // Build layered context (L1 + L2)
  let context = '';
  if (clientId) {
    const client = await getClientById(clientId);
    if (client) {
      context += `Client: ${client.name}, ${client.industry}. ${client.aiSummary ?? ''}\n`;
    }
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
    messages: convertToModelMessages(messages),
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
            ? lastUserMessage.content
            : 'Research query',
          response: text,
          sources: [],
        }).catch(console.error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

Key decisions documented:
- Uses `createAnthropic` (NOT the default `anthropic` singleton) because Pattern D needs per-request provider with user's own API key.
- Uses `maxSteps: 5` (NOT `stopWhen: stepCountIs(5)`). The `maxSteps` parameter is what the codebase uses in all other AI routes.
- `onFinish` saves research notes in background with `.catch(console.error)` to prevent save failures from crashing the stream.
- `createResearchNote` does NOT pass `createdBy` — the `researchNotes` schema has no such column.
- `convertToModelMessages` may need `await` depending on version — Step 7.0.7 determined this. If the installed version returns a Promise, add `await`.

### 7.1.3 — Client Hook

CREATE: `src/lib/hooks/use-research-context.ts`

```typescript
'use client';

import { usePathname } from 'next/navigation';

/**
 * Extracts clientId and processId from the current URL path.
 * Pattern: /clients/[clientId]/processes/[processId]/...
 */
export function useResearchContext() {
  const pathname = usePathname();

  const clientMatch = pathname.match(/\/clients\/([^/]+)/);
  const processMatch = pathname.match(/\/processes\/([^/]+)/);

  return {
    clientId: clientMatch?.[1] ?? undefined,
    processId: processMatch?.[1] ?? undefined,
  };
}
```

### 7.1.4 — Client Component

CREATE: `src/components/layout/research-panel.tsx`

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { useResearchContext } from '@/lib/hooks/use-research-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Brain, Trash2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';

interface ResearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResearchPanel({ open, onOpenChange }: ResearchPanelProps) {
  const { clientId, processId } = useResearchContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // IMPORTANT: Verify actual useChat API shape per Step 7.0.6
  // CLAUDE.md says: sendMessage, status
  // If your installed version uses handleSubmit + input + setInput, adapt accordingly
  const {
    messages,
    sendMessage, // or: handleSubmit, input, setInput — depends on version
    status,
    setMessages,
    error,
  } = useChat({
    api: '/api/ai/research',
    body: { clientId, processId },
  });

  const [inputValue, setInputValue] = useState('');

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmitMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status === 'streaming') return;
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleClear = () => {
    setMessages([]);
  };

  // Check if error is a 422 (no API key)
  const isApiKeyError = error?.message?.includes('422') || error?.message?.includes('No API key');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Research
          </SheetTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {isApiKeyError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-medium text-amber-800">API Key Required</p>
                <p className="text-amber-700 mt-1">
                  Set your Anthropic API key in Settings to use AI Research.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Ask about the client, industry, process patterns...
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`${
                    message.role === 'user'
                      ? 'ml-8 bg-primary/10 rounded-lg p-3'
                      : 'mr-4'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {message.parts
                          ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                          .map((part) => part.text)
                          .join('') ?? ''}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {typeof message.content === 'string'
                        ? message.content
                        : message.parts
                            ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                            .map((part) => part.text)
                            .join('') ?? ''}
                    </p>
                  )}
                </div>
              ))
            )}
            {status === 'streaming' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Researching...
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmitMessage} className="border-t p-3">
            <div className="flex gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a research question..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitMessage(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim() || status === 'streaming'}
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

IMPORTANT NOTES FOR IMPLEMENTER:
- The `useChat` hook's API may differ from what is shown. Step 7.0.6 determined the actual API. Common variations:
  - v4+: `sendMessage({ text })` + `status` field
  - Alternate: `handleSubmit(e)` with controlled `input`/`setInput` from the hook itself
  - Alternate: `append({ role: 'user', content: text })`
- Adjust `handleSubmitMessage` and the destructured hook values to match what you found in 7.0.6.
- `message.parts` is the v4+ API. If your version uses `message.content` as a string, adapt the rendering to use `message.content` directly.

### 7.1.5 — Layout Integration

MODIFY: `src/app/(dashboard)/layout.tsx`

Add a Research button in the dashboard header and render the `<ResearchPanel />`:

```typescript
// Add to imports:
import { ResearchPanel } from '@/components/layout/research-panel';
import { Brain } from 'lucide-react';

// Add state in the client wrapper component:
const [researchOpen, setResearchOpen] = useState(false);

// Add button in header bar (next to breadcrumb or user button):
<Button
  variant="ghost"
  size="sm"
  onClick={() => setResearchOpen(true)}
  className="gap-2"
>
  <Brain className="h-4 w-4" />
  <span className="hidden sm:inline">Research</span>
</Button>

// Render panel:
<ResearchPanel open={researchOpen} onOpenChange={setResearchOpen} />
```

If the dashboard layout is a Server Component, the Research button and panel state must live in a Client Component wrapper. Check the existing layout structure:

```bash
head -5 src/app/\(dashboard\)/layout.tsx
```

If it starts with `'use client'`, add state directly. If it's a Server Component, create a new Client Component wrapper:

CREATE (if needed): `src/components/layout/dashboard-header-actions.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';
import { ResearchPanel } from '@/components/layout/research-panel';

export function DashboardHeaderActions() {
  const [researchOpen, setResearchOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setResearchOpen(true)}
        className="gap-2"
      >
        <Brain className="h-4 w-4" />
        <span className="hidden sm:inline">Research</span>
      </Button>
      <ResearchPanel open={researchOpen} onOpenChange={setResearchOpen} />
    </>
  );
}
```

Then import `<DashboardHeaderActions />` in the Server Component layout.

### 7.1 — Verification

```bash
npx vitest run src/__tests__/api/ai-research.test.ts
npx next build  # No TS errors
```

### 7.1 — Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `useChat` API shape differs from CLAUDE.md | Step 7.0.6 checks actual exports before coding |
| `convertToModelMessages` import path wrong | Step 7.0.7 checks actual export location |
| `onFinish` may not fire on stream timeout | `.catch(console.error)` wrapper; research notes are non-critical |
| Dashboard layout is Server Component | `DashboardHeaderActions` wrapper pattern provided |
| `message.parts` doesn't exist in installed version | Check version; fallback to `message.content` string rendering |

---

## Step 7.2 — Follow-Up Email Draft

### 7.2.1 — Tests (RED)

CREATE: `src/__tests__/api/sessions-email-draft.test.ts`

Tests:

1. Returns 403 for viewer role
2. Returns 422 if no API key configured (depends on how `getAIConfig` handles it — Step 7.0.8)
3. Returns 404 if session not found
4. Returns 400 if session has no synthesis output (check actual field name from 7.0.11)
5. Returns generated email text on success (language: 'en')
6. Generates email in Spanish when `language: 'es'` is passed
7. Includes session contacts (names + roles) in the AI prompt
8. Uses `getAIConfig('research')` for model resolution (not streaming — plain `generateText`)

Mock pattern:

```typescript
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: 'Dear team, following up on our session...',
  }),
}));

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    model: { modelId: 'claude-sonnet-4-20250514' },
    anthropic: {},
  }),
}));

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessById: vi.fn(),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

vi.mock('@/lib/db/queries/contacts', () => ({
  listContactsByClient: vi.fn(),
}));
```

### 7.2.2 — AI Prompt Function

CREATE: `src/lib/ai/prompts/email-draft.ts`

```typescript
import { generateText } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';

interface EmailDraftInput {
  clientName: string;
  processName: string;
  contacts: Array<{ name: string; role?: string | null }>;
  synthesisHighlights: string;
  openQuestions: string[];
  language: 'en' | 'es';
}

export async function generateFollowUpEmail(input: EmailDraftInput): Promise<string> {
  const { model } = await getAIConfig('research');

  const languageInstruction = input.language === 'es'
    ? 'Write the email entirely in Spanish (formal business Spanish).'
    : 'Write the email in English.';

  const { text } = await generateText({
    model,
    maxTokens: 1000,
    system: `You are a Forward Deployed Engineer drafting a professional follow-up email to a client contact after a discovery session. ${languageInstruction}`,
    prompt: `Client: ${input.clientName}
Process: ${input.processName}
Contacts: ${input.contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ')}

Session highlights:
${input.synthesisHighlights}

Open questions to address:
${input.openQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Draft a warm, concise follow-up email (3 paragraphs max + numbered question list). Thank them for their time, summarize key takeaways, list open questions, and propose a clear next step. Respond with the email body only (no subject line, no signature).`,
  });

  return text;
}
```

### 7.2.3 — API Route

IMPORTANT: Before creating the route file, determine the correct path from Step 7.0.9.

The route path depends on the existing codebase convention. Check:
- If sessions use `/api/sessions/[sessionId]/...` → use `/api/sessions/[sessionId]/email-draft/route.ts`
- If sessions use `/api/clients/[id]/processes/[processId]/sessions/[sessionId]/...` → use that nesting

The code below uses the flat pattern. Adjust the path if the codebase uses nested routes.

CREATE: `src/app/api/sessions/[sessionId]/email-draft/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getProcessById } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { listContactsByClient } from '@/lib/db/queries/contacts';
import { generateFollowUpEmail } from '@/lib/ai/prompts/email-draft';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;

    // Load session
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Validate synthesis exists
    // IMPLEMENTER: Use the actual field name from Step 7.0.11
    // It may be `synthesisOutput`, `synthesisResult`, or similar
    if (!session.synthesisOutput) {
      return NextResponse.json(
        { error: 'Session has no synthesis output. Run synthesis first.' },
        { status: 400 }
      );
    }

    // Load process to get clientId
    const process = await getProcessById(session.processId);
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    // Load client to get name
    // IMPLEMENTER: Step 7.0.10 determined if getProcessById joins client data.
    // If process has client.name, use it directly.
    // Otherwise, fetch client separately as shown:
    const client = await getClientById(process.clientId);
    const clientName = client?.name ?? 'Client';

    // Load contacts
    const contacts = await listContactsByClient(process.clientId);

    // Parse request body for language preference
    const body = await req.json().catch(() => ({}));
    const language = body.language === 'es' ? 'es' : 'en';

    // Extract synthesis highlights
    // IMPLEMENTER: Adapt field names to match actual synthesisOutput shape.
    // Check what Phase 6 synthesis actually produces.
    const synthesis = session.synthesisOutput as any;
    const highlights = synthesis.summary
      ?? synthesis.sessionSummary
      ?? JSON.stringify(synthesis).slice(0, 500);
    const openQuestions = (synthesis.openQuestions ?? synthesis.newQuestions ?? [])
      .map((q: any) => {
        if (typeof q === 'string') return q;
        return q.text ?? q.question ?? String(q);
      });

    // Generate email
    const email = await generateFollowUpEmail({
      clientName,
      processName: process.name,
      contacts: contacts.map((c) => ({ name: c.name, role: c.role })),
      synthesisHighlights: typeof highlights === 'string' ? highlights : JSON.stringify(highlights),
      openQuestions,
      language,
    });

    return NextResponse.json({ email });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### 7.2.4 — UI Component

CREATE: `src/components/sessions/email-draft-card.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmailDraftCardProps {
  sessionId: string;
}

export function EmailDraftCard({ sessionId }: EmailDraftCardProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/email-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });

      if (res.status === 422) {
        toast.error('Set your Anthropic API key in Settings to use AI features.');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to generate email');
        return;
      }

      const data = await res.json();
      setEmail(data.email);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Follow-Up Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Language toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant={language === 'en' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('en')}
          >
            EN
          </Button>
          <Button
            variant={language === 'es' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('es')}
          >
            ES
          </Button>
        </div>

        {email ? (
          <>
            <textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[200px] rounded-md border px-3 py-2 text-sm resize-y"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isLoading}>
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleGenerate} disabled={isLoading} size="sm">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              'Generate Follow-Up Email'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### 7.2.5 — Integration

MODIFY: The session detail/overview component where synthesis output is displayed.

First, find the correct file:

```bash
grep -rn "synthesisOutput\|synthesis_done\|synthesis" src/components/sessions/ --include="*.tsx" -l
```

Then add:

```typescript
import { EmailDraftCard } from '@/components/sessions/email-draft-card';

// Inside the component, after synthesis output display:
// IMPLEMENTER: Adapt the condition. If there's no 'synthesis_done' status (Step 7.0.12),
// check session.synthesisOutput !== null instead.
{session.synthesisOutput && isAdmin && (
  <EmailDraftCard sessionId={session.id} />
)}
```

The `isAdmin` check uses the inline pattern for now: `(user?.publicMetadata as any)?.role === 'admin'`. This will be refactored to `useRole()` in Step 7.4.

### 7.2 — Verification

```bash
npx vitest run src/__tests__/api/sessions-email-draft.test.ts
npx next build
```

### 7.2 — Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `getProcessById` doesn't include client name | Step 7.0.10 checks; sequential `getClientById` fetch provided as fallback |
| `synthesisOutput` field name differs | Step 7.0.11 binds actual field name |
| `synthesisOutput` schema varies between session types | Access both `summary` and `sessionSummary` with fallback chain |
| `getAIConfig` throws NO_API_KEY not caught | Step 7.0.8 verifies; `handleAPIError` should map to 422 |
| Session status enum lacks `synthesis_done` | Step 7.0.12 verifies; fallback to null-check on synthesis field |

---

## Step 7.3 — Artifact Upload

### 7.3.0 — Supabase Bucket Setup

Create the `artifacts` bucket via Supabase MCP or dashboard:

```
Bucket name: artifacts
Public: false (private — use signed URLs for download)
File size limit: 25MB
Allowed MIME types: (leave empty — allow all types)
```

Via MCP: use the Supabase MCP `create_bucket` tool if available. Otherwise, create manually in the Supabase dashboard under Storage > New Bucket.

Verify the bucket exists before proceeding:

```bash
# Quick check — create a temporary Node script
node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.storage.listBuckets().then(({ data }) => console.log(data?.map(b => b.name)));
"
```

If `artifacts` is not in the list, the bucket creation failed. Retry before proceeding.

### 7.3.1 — Storage Client

CHECK if `src/lib/supabase/storage.ts` exists:

```bash
cat src/lib/supabase/storage.ts 2>/dev/null || echo "FILE NOT FOUND"
```

CREATE or MODIFY: `src/lib/supabase/storage.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Upload a file to a Supabase Storage bucket.
 * @returns The storage path of the uploaded file.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: false });

  if (error) throw error;
  return data.path;
}

/**
 * Delete a file from a Supabase Storage bucket.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/**
 * Get a signed URL for downloading a private file.
 * @param expiresIn Expiry time in seconds (default: 1 hour).
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
```

### 7.3.2 — Tests (RED)

CREATE: `src/__tests__/api/artifacts.test.ts`

Tests:

1. GET list returns 401 if not authenticated
2. GET list returns artifacts for process (filters soft-deleted via query)
3. POST upload returns 403 for viewer role
4. POST upload returns 400 if no file in form data
5. POST upload stores file via `uploadFile()` + creates artifact DB record via `createArtifact()`
6. POST upload passes correct schema fields (`filename`, `storagePath`, `fileSizeBytes`, `mimeType`) — NOT `title`, `fileUrl`, `type`
7. POST upload returns 400 if file exceeds 25MB
8. DELETE returns 403 for viewer role
9. DELETE soft-deletes artifact record + calls `deleteFile()` to remove from storage
10. GET single artifact returns signed URL via `getSignedUrl()`
11. GET single artifact returns 404 for soft-deleted artifact

Mock all storage functions:

```typescript
vi.mock('@/lib/supabase/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('process-1/abc-file.pdf'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/file.pdf'),
}));
```

CRITICAL TEST for schema correctness (test #6):

```typescript
it('creates artifact with correct schema fields', async () => {
  // ... setup upload ...
  expect(createArtifact).toHaveBeenCalledWith(expect.objectContaining({
    processId: 'process-1',
    filename: 'test.pdf',           // NOT 'title'
    storagePath: expect.any(String), // NOT 'fileUrl'
    fileSizeBytes: expect.any(Number),
    mimeType: 'application/pdf',    // NOT 'type'
    stage: 'reference',
  }));
  // Must NOT contain createdBy
  expect(createArtifact).toHaveBeenCalledWith(
    expect.not.objectContaining({ createdBy: expect.anything() })
  );
});
```

### 7.3.3 — Artifact Query Functions (if missing)

If Step 7.0.5 revealed that artifact query functions don't exist:

CREATE or MODIFY: `src/lib/db/queries/artifacts.ts`

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { artifacts, type NewArtifact } from '../schema';

const notDeleted = isNull(artifacts.deletedAt);

export async function createArtifact(data: NewArtifact) {
  const [artifact] = await db.insert(artifacts).values(data).returning();
  return artifact;
}

export async function listArtifactsByProcess(processId: string) {
  return db.select().from(artifacts)
    .where(and(eq(artifacts.processId, processId), notDeleted))
    .orderBy(desc(artifacts.createdAt));
}

export async function getArtifactById(id: string) {
  const [artifact] = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), notDeleted));
  return artifact ?? null;
}

export async function softDeleteArtifact(id: string) {
  const now = new Date();
  const [deleted] = await db.update(artifacts)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(artifacts.id, id))
    .returning();
  return deleted ?? null;
}
```

### 7.3.4 — API Routes

IMPORTANT: Before creating route files, use the route pattern determined in Step 7.0.9.

The code below uses a nested pattern `/api/clients/[id]/processes/[processId]/artifacts/...`. If your codebase uses a flatter pattern, adjust the file paths and the `params` destructuring accordingly.

CREATE: `src/app/api/clients/[id]/processes/[processId]/artifacts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { listArtifactsByProcess, createArtifact } from '@/lib/db/queries/artifacts';
import { uploadFile } from '@/lib/supabase/storage';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAuth();
    const { processId } = await params;
    const artifacts = await listArtifactsByProcess(processId);
    return NextResponse.json(artifacts);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  try {
    await requireAdmin();
    const { processId } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const stage = (formData.get('stage') as string) ?? null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${processId}/${randomUUID()}-${file.name}`;
    await uploadFile('artifacts', storagePath, buffer, file.type);

    // Create DB record — use EXACT schema column names
    const artifact = await createArtifact({
      processId,
      filename: file.name,             // Schema: filename (NOT title)
      storagePath,                      // Schema: storagePath (NOT fileUrl)
      fileSizeBytes: file.size,         // Schema: fileSizeBytes (required)
      mimeType: file.type,             // Schema: mimeType (NOT type)
      stage: stage as any ?? null,      // Schema: artifactStageEnum (nullable)
      // NOTE: No createdBy — schema has no such column
      // NOTE: No sessionId here — uploaded from process context
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

CREATE: `src/app/api/clients/[id]/processes/[processId]/artifacts/[artifactId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getArtifactById, softDeleteArtifact } from '@/lib/db/queries/artifacts';
import { getSignedUrl, deleteFile } from '@/lib/supabase/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string; artifactId: string }> }
) {
  try {
    await requireAuth();
    const { artifactId } = await params;
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const url = await getSignedUrl('artifacts', artifact.storagePath);
    return NextResponse.json({ ...artifact, downloadUrl: url });
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string; artifactId: string }> }
) {
  try {
    await requireAdmin();
    const { artifactId } = await params;
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Soft-delete DB record + remove from storage
    await softDeleteArtifact(artifactId);
    await deleteFile('artifacts', artifact.storagePath).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### 7.3.5 — SWR Hook

CREATE: `src/lib/hooks/use-artifacts.ts`

```typescript
import useSWR from 'swr';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('API error');
    return r.json();
  });

export function useArtifacts(clientId: string, processId: string) {
  const key = clientId && processId
    ? `/api/clients/${clientId}/processes/${processId}/artifacts`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher);

  return {
    artifacts: data ?? [],
    isLoading,
    error,
    mutateArtifacts: mutate,
  };
}
```

### 7.3.6 — UI Component

CREATE: `src/components/processes/artifacts-panel.tsx`

```typescript
'use client';

import { useArtifacts } from '@/lib/hooks/use-artifacts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useRef, useState } from 'react';

interface ArtifactsPanelProps {
  clientId: string;
  processId: string;
  isAdmin: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactsPanel({ clientId, processId, isAdmin }: ArtifactsPanelProps) {
  const { artifacts, isLoading, mutateArtifacts } = useArtifacts(clientId, processId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // CRITICAL: Use actual artifactStageEnum values: input, intermediate, output, reference
  const [uploadStage, setUploadStage] = useState<string>('reference');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 25MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stage', uploadStage);

      const res = await fetch(
        `/api/clients/${clientId}/processes/${processId}/artifacts`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Upload failed');
        return;
      }

      toast.success('File uploaded');
      mutateArtifacts();
    } catch {
      toast.error('Network error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (artifactId: string) => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/processes/${processId}/artifacts/${artifactId}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.downloadUrl, '_blank');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (artifactId: string) => {
    if (!confirm('Delete this artifact?')) return;
    try {
      const res = await fetch(
        `/api/clients/${clientId}/processes/${processId}/artifacts/${artifactId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      toast.success('Artifact deleted');
      mutateArtifacts();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Artifacts
        </CardTitle>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {/* CRITICAL: Use actual artifactStageEnum values */}
            <Select value={uploadStage} onValueChange={setUploadStage}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="input">Input</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="output">Output</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : artifacts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No artifacts uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {artifacts.map((artifact: any) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between py-2 px-3 rounded-md border text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{artifact.filename}</span>
                  {artifact.stage && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {artifact.stage}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(artifact.fileSizeBytes)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(artifact.id)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleDelete(artifact.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 7.3.7 — Integration

Find the process overview/detail component:

```bash
grep -rn "processId\|process-overview\|ProcessOverview" src/components/processes/ --include="*.tsx" -l
```

MODIFY the relevant component:

```typescript
import { ArtifactsPanel } from '@/components/processes/artifacts-panel';

// Inside the component:
<ArtifactsPanel clientId={clientId} processId={processId} isAdmin={isAdmin} />
```

### 7.3 — Verification

```bash
npx vitest run src/__tests__/api/artifacts.test.ts
npx next build
```

### 7.3 — Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Bucket doesn't exist → uploads fail | Step 7.3.0 creates and verifies it first |
| `@supabase/supabase-js` not installed | Step 7.0.2 installs it |
| Artifact schema fields wrong in code | Step 7.0.3 binds ALL column names before coding; test #6 validates |
| `artifactStageEnum` values wrong in UI | Step 7.0.3 binds actual enum values; UI uses `input/intermediate/output/reference` |
| `createArtifact` passes `createdBy` → DB error | Step 7.0.3 documents NO `createdBy` column; test validates absence |
| `NewArtifact` type doesn't match passed fields | Grep `NewArtifact` type from schema — it's auto-generated by Drizzle |

---

## Step 7.4 — Viewer Role Enforcement

### 7.4.1 — useRole Hook

CREATE: `src/lib/hooks/use-role.ts`

```typescript
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

### 7.4.2 — Tests (RED)

CREATE: `src/__tests__/hooks/use-role.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
}));

import { useUser } from '@clerk/nextjs';
import { useRole } from '@/lib/hooks/use-role';

describe('useRole', () => {
  it('returns isAdmin: true when role is admin', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'admin', hasApiKey: true } },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isViewer).toBe(false);
    expect(result.current.hasApiKey).toBe(true);
  });

  it('returns isViewer: true when role is viewer', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'viewer' } },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current.isViewer).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('defaults to viewer when no publicMetadata', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: {} },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current.role).toBe('viewer');
    expect(result.current.isViewer).toBe(true);
  });

  it('defaults to viewer when user is null', () => {
    (useUser as any).mockReturnValue({ user: null });
    const { result } = renderHook(() => useRole());
    expect(result.current.role).toBe('viewer');
    expect(result.current.isViewer).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('returns hasApiKey: false when not set', () => {
    (useUser as any).mockReturnValue({
      user: { publicMetadata: { role: 'admin' } },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current.hasApiKey).toBe(false);
  });
});
```

CREATE: `src/__tests__/api/viewer-enforcement.test.ts`

Tests using the existing `requireAdmin` mock pattern:

1. Viewer gets 403 on POST `/api/clients` (create)
2. Viewer gets 403 on DELETE `/api/sessions/[id]`
3. Viewer gets 403 on POST `/api/sessions/[id]/synthesize`
4. Viewer CAN GET `/api/clients` (list) — 200
5. Viewer CAN GET `/api/sessions/[id]` (detail) — 200
6. Viewer gets 403 on POST `/api/ai/research`
7. Viewer gets 403 on POST `/api/sessions/[id]/email-draft`
8. Viewer gets 403 on POST artifacts upload

These tests verify the BACKEND enforcement that already exists via `requireAdmin()`. They serve as regression tests to ensure no write route was accidentally left unprotected.

IMPORTANT: Before writing these tests, enumerate ALL write routes in the codebase:

```bash
grep -rn "requireAdmin\|requireAuth" src/app/api/ --include="*.ts" -l
```

Verify every POST, PUT, PATCH, DELETE route calls `requireAdmin()`. If any write route only calls `requireAuth()` (allowing viewers to write), that's a bug — fix it.

### 7.4.3 — Frontend Gating (refactor)

Replace all inline `(user?.publicMetadata as any)?.role === 'admin'` patterns with `useRole()`.

Find all occurrences:

```bash
grep -rn "publicMetadata.*role.*admin\|isAdmin.*publicMetadata\|role.*===.*admin" src/components/ --include="*.tsx"
```

MODIFY each file found, plus the new components from this phase:

Pattern for each refactored file:

```typescript
// BEFORE:
import { useUser } from '@clerk/nextjs';
const { user } = useUser();
const isAdmin = (user?.publicMetadata as any)?.role === 'admin';

// AFTER:
import { useRole } from '@/lib/hooks/use-role';
const { isAdmin } = useRole();
```

Expected files to modify (verify with grep):

- Session overview/detail — hide write buttons (edit, delete, run synthesis) for viewers
- Process overview/detail — hide edit/delete for viewers
- Client detail — hide edit/delete for viewers
- Transcript/notes editor — make textarea `readOnly` for viewers
- Research panel trigger in layout — hide for users without API key via `hasApiKey`
- Email draft card (from 7.2) — already gated by `isAdmin` in integration
- Artifacts panel (from 7.3) — already receives `isAdmin` prop

### 7.4 — Verification

```bash
npx vitest run src/__tests__/hooks/use-role.test.ts
npx vitest run src/__tests__/api/viewer-enforcement.test.ts
npx next build
```

### 7.4 — Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Missing a UI element that should be hidden | Grep for ALL `isAdmin` patterns and audit the full list |
| `useUser` not available in some components | `useRole` only works in Client Components — verify each file has `'use client'` |
| Backend route missing `requireAdmin` on a write endpoint | Viewer enforcement tests + grep audit catch unprotected routes |
| `useUser` returns `{ user: null }` during loading | Hook defaults to `viewer` — safe default, prevents flash of admin UI |

---

## Step 7.6 — Polish

### 7.6.1 — Error Boundaries

All error boundaries follow the same pattern. Create them:

CREATE: `src/app/(dashboard)/error.tsx`
CREATE: `src/app/(dashboard)/clients/[clientId]/error.tsx`
CREATE: `src/app/(dashboard)/clients/[clientId]/processes/[processId]/error.tsx`
CREATE: `src/app/(dashboard)/clients/[clientId]/processes/[processId]/sessions/[sessionId]/error.tsx`

IMPORTANT: Verify the actual route segment names first:

```bash
find src/app/\(dashboard\) -type d | head -20
```

The segment names above (`[clientId]`, `[processId]`, `[sessionId]`) may differ in the actual codebase (e.g., `[id]`, `[slug]`). Use the actual names.

Template for all (adjust the copy per level):

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### 7.6.2 — Not Found Pages

CREATE: `src/app/(dashboard)/clients/[clientId]/not-found.tsx`
CREATE: `src/app/(dashboard)/clients/[clientId]/processes/[processId]/not-found.tsx`

(Again, use actual segment names from the codebase.)

Template:

```typescript
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold">Not Found</h2>
      <p className="text-sm text-muted-foreground">
        The resource you're looking for doesn't exist or has been deleted.
      </p>
      <Button asChild variant="outline">
        <Link href="/clients">Back to Clients</Link>
      </Button>
    </div>
  );
}
```

IMPORTANT: Verify that the page.tsx files for client detail and process detail call `notFound()` when data is missing:

```bash
grep -rn "notFound" src/app/\(dashboard\)/ --include="*.tsx"
```

If no `notFound()` calls exist in the page components, add them:

```typescript
import { notFound } from 'next/navigation';

// In the page component, after fetching data:
const client = await getClientById(clientId);
if (!client) notFound();
```

### 7.6.3 — Mobile Responsiveness Audit

VERIFY: `src/components/layout/research-panel.tsx`
- Already uses `w-full sm:w-[420px]` — confirm this is in place.

AUDIT existing grid layouts:

```bash
grep -rn "grid-cols" src/components/ src/app/ --include="*.tsx" | grep -v "node_modules"
```

For each grid found, verify it has a responsive mobile fallback (e.g., `grid-cols-1 lg:grid-cols-2`). Fix any that don't.

Common patterns to check:
- Process overview: 2-column layout → should stack on mobile
- Session detail: tabs + content → should be full-width on mobile
- Client detail: sidebar + main → should stack on mobile

### 7.6.4 — Final Verification

```bash
# All tests pass
npx vitest run

# Clean build, no TS errors
npx next build

# Update SPEC.md — mark all Phase 7 steps as complete
# Update current state, total test count
```

### 7.6 — Risks

| Risk | Mitigation |
|------|-----------|
| Error boundaries are Server Components by default | ALL error.tsx files MUST have `'use client'` directive |
| `notFound()` must be called from page.tsx | Verify each page.tsx calls it when data is missing |
| Route segment names differ from plan | Step 7.6.1 verifies actual directory names first |
| Mobile audit is manual | Limited to grep + visual review of responsive classes |

---

## File Summary

| Step | CREATE | MODIFY |
|------|--------|--------|
| 7.0 | `queries/research-notes.ts` (if missing), `queries/artifacts.ts` (if missing) | — |
| 7.5 | — | `SPEC.md` |
| 7.1 | `api/ai/research/route.ts`, `components/layout/research-panel.tsx`, `hooks/use-research-context.ts`, `__tests__/api/ai-research.test.ts`, `components/layout/dashboard-header-actions.tsx` (if layout is Server Component) | `app/(dashboard)/layout.tsx` |
| 7.2 | `api/sessions/[sessionId]/email-draft/route.ts`, `ai/prompts/email-draft.ts`, `components/sessions/email-draft-card.tsx`, `__tests__/api/sessions-email-draft.test.ts` | session detail/overview component |
| 7.3 | `api/.../artifacts/route.ts`, `api/.../artifacts/[artifactId]/route.ts`, `hooks/use-artifacts.ts`, `components/processes/artifacts-panel.tsx`, `__tests__/api/artifacts.test.ts` | `lib/supabase/storage.ts`, process overview component |
| 7.4 | `hooks/use-role.ts`, `__tests__/hooks/use-role.test.ts`, `__tests__/api/viewer-enforcement.test.ts` | 5-7 component files (role refactor) |
| 7.6 | 4× `error.tsx`, 2× `not-found.tsx` | page.tsx files (add `notFound()` calls if missing), `SPEC.md` |

Total: ~23 new files, ~12 modifications

---

## Schema Binding Table (Step 7.0 Output)

Fill this table during Step 7.0. Every value must be resolved via `grep` before writing ANY code.

| Binding Key | Expected Value | Actual Value (fill via grep) | Used In |
|-------------|---------------|------------------------------|---------|
| Artifact filename column | `filename` | _________________ | 7.3.4, 7.3.6 |
| Artifact storage path column | `storagePath` | _________________ | 7.3.4 |
| Artifact file size column | `fileSizeBytes` | _________________ | 7.3.4 |
| Artifact MIME type column | `mimeType` | _________________ | 7.3.4 |
| Artifact stage enum values | `input, intermediate, output, reference` | _________________ | 7.3.4, 7.3.6 |
| Artifact has `createdBy`? | NO | _________________ | 7.3.4 |
| ResearchNote has `createdBy`? | NO | _________________ | 7.1.2 |
| ResearchNote has `deletedAt`? | NO | _________________ | 7.0.5 |
| Session synthesis field name | `synthesisOutput` | _________________ | 7.2.3 |
| Session status enum has `synthesis_done`? | Check | _________________ | 7.2.5 |
| `getProcessById` includes client data? | Check | _________________ | 7.2.3 |
| `convertToModelMessages` import package | `'ai'` | _________________ | 7.1.2 |
| `useChat` API: `sendMessage` or `append`? | Check | _________________ | 7.1.4 |
| `handleAPIError` maps NO_API_KEY to 422? | Check | _________________ | 7.2.3 |
| Route nesting pattern for artifacts | Check | _________________ | 7.3.4 |
| Route nesting pattern for sessions | Check | _________________ | 7.2.3 |
| Dashboard layout: Server or Client Component? | Check | _________________ | 7.1.5 |
| Route segment name for client ID | `[clientId]` or `[id]` | _________________ | 7.6.1 |

**DO NOT PROCEED PAST STEP 7.0 UNTIL THIS TABLE IS COMPLETE.**

---

## Verification Protocol

After EACH step:

1. `npx vitest run` — all tests pass (including new ones)
2. `npx next build` — clean build, no TS errors
3. Update `SPEC.md` with completed step

Final gate checklist:

- [ ] Research panel streams with web search using user's API key
- [ ] Research panel auto-includes client/process context from current page
- [ ] Research notes saved to DB without `createdBy` (schema has no such column)
- [ ] Email draft generates in both EN and ES
- [ ] Email draft editable in textarea before copying
- [ ] Artifacts bucket exists in Supabase
- [ ] Artifact upload uses correct schema fields: `filename`, `storagePath`, `fileSizeBytes`, `mimeType`
- [ ] Artifact stage dropdown uses correct enum values: `input`, `intermediate`, `output`, `reference`
- [ ] Artifact upload/download works end-to-end
- [ ] Artifact delete soft-deletes + removes from storage
- [ ] Viewer can browse clients, processes, sessions (GET routes)
- [ ] Viewer CANNOT create, edit, delete, synthesize, or use AI features (403)
- [ ] All write action buttons hidden for viewer role in UI
- [ ] Error boundaries catch and display errors gracefully at all route levels
- [ ] Not-found pages render for missing clients and processes
- [ ] Mobile: research panel is full-width, grid layouts stack
- [ ] All 440+ tests pass, build clean
- [ ] 