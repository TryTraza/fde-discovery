# FDE Discovery Tool — Claude Code Instructions

> This file is the single source of truth for every Claude Code session.
> Read it fully at the start of every session, every time.

---

## 🔴 SESSION START RITUAL (MANDATORY — NO EXCEPTIONS)

Before writing a single line of code, do all of these:

1. **Read `SPEC.md`** — understand current state, what's done, what's next
2. **Read the current phase doc** (`docs/01-PHASE-0-SETUP.md`, etc.)
3. **State your plan** in exactly this format:

```
PLAN FOR THIS SESSION:
- Building: [1 sentence — what feature/step]
- Files I will CREATE: [list]
- Files I will MODIFY: [list]
- Files I will NOT touch: [list]
- Done looks like: [1 sentence — testable outcome]
```

4. **STOP. Wait for explicit approval before writing any code.**

If you start writing code before approval, stop immediately.

---

## 🛠️ AVAILABLE MCP TOOLS

You have direct access to two MCP servers. **Use them — don't ask Alberto to run commands manually.**

### Supabase MCP
Use for all database operations:
- **Run migrations** — after `drizzle-kit generate`, apply via MCP instead of asking Alberto to run CLI
- **Inspect tables** — verify schema after migrations, check column types, confirm data
- **Query data** — check seed data, debug query issues, verify soft deletes
- **Check RLS** — we don't use RLS (Clerk handles auth), but verify no accidental policies block queries

When to use: after every `drizzle-kit generate`, after seed scripts, when debugging DB issues.

### Clerk MCP
Use for user/auth operations during development:
- **Set user metadata** — set `role: admin` on Alberto's user, set `hasApiKey: true` after testing
- **Read user metadata** — verify publicMetadata and privateMetadata are structured correctly
- **Create test users** — create viewer-role users for testing permission boundaries
- **Inspect sessions** — debug auth issues

When to use: Phase 0 (settings page testing), any time a permission bug needs investigation.

### Rule: Prefer MCP over CLI
If an operation can be done via MCP, do it via MCP. Don't instruct Alberto to run `drizzle-kit push` in the terminal if you can execute the migration directly. Don't ask him to update Clerk metadata in the dashboard if you can do it via MCP.

---

## 🏗️ ARCHITECTURE (Never Violate)

### Stack
- **Framework:** Next.js 15 (App Router, `src/` dir, TypeScript)
- **UI:** shadcn/ui (New York style, Zinc color) + AI Elements
- **ORM:** Drizzle ORM — ALL DB access via query functions in `lib/db/queries/*`
- **Auth:** Clerk — middleware-only, no Supabase RLS
- **Storage:** Supabase Storage (file uploads only — never for data queries)
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with per-user API keys
- **Data fetching:** SWR for client-side, not React Query
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Deploy:** Vercel

### Hard Rules
- **No raw SQL** — use Drizzle query functions only
- **No Supabase client for data** — storage only (`lib/supabase/storage.ts`)
- **No server-side `ANTHROPIC_API_KEY`** — every AI call uses the user's key from Clerk `privateMetadata`
- **`await params`** — Next.js 15: `params` is a Promise in dynamic routes, always `const { id } = await params`
- **`requireAdmin()`** on all write API routes, **`requireAuth()`** on all read routes
- **`handleAPIError(error)`** in every API route catch block — never return raw error messages
- **`generateObject()`** for structured AI output (guaranteed JSON), **`generateText()`** for prose
- One query function per operation — no fat functions combining multiple concerns

---

## 🔑 PER-USER AI KEYS (Critical Pattern)

There is NO `ANTHROPIC_API_KEY` in `.env`. Each user stores their own key in Clerk `privateMetadata`.

### The Helper (`lib/ai/get-ai-config.ts`)
```typescript
import { currentUser } from '@clerk/nextjs/server';
import { createAnthropic } from '@ai-sdk/anthropic';

export type AIFeature = 'research' | 'hypothesis' | 'suggestions' | 'synthesis' | 'interview';

const DEFAULT_MODELS: Record<AIFeature, string> = {
  research:    'claude-sonnet-4-20250514',
  hypothesis:  'claude-sonnet-4-20250514',
  suggestions: 'claude-haiku-3-5-20241022',  // Fast + cheap for real-time capture
  synthesis:   'claude-sonnet-4-20250514',
  interview:   'claude-sonnet-4-20250514',
};

export async function getAIConfig(feature: AIFeature) {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const apiKey = (user.privateMetadata as any)?.anthropicApiKey;
  if (!apiKey) throw new Error('NO_API_KEY');

  const modelPrefs = (user.publicMetadata as any)?.aiModels ?? {};
  const modelId = modelPrefs[feature] || DEFAULT_MODELS[feature];
  const anthropic = createAnthropic({ apiKey });

  return {
    model: anthropic(modelId),
    modelId,
    anthropic, // For tool access: anthropic.tools.webSearch_20250305()
  };
}
```

### Usage Pattern
```typescript
// Structured output
const { model } = await getAIConfig('hypothesis');
const { object } = await generateObject({ model, schema: mySchema, ... });

// Text with web search
const { model, anthropic } = await getAIConfig('research');
const { text } = await generateText({
  model,
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  maxSteps: 3,
  ...
});
```

### Error Handling (Always Use)
```typescript
try {
  const { model } = await getAIConfig('synthesis');
  // ... AI call
} catch (error) {
  return handleAPIError(error); // Maps NO_API_KEY → 422, Unauthorized → 401, etc.
}
```

### Frontend: Handle 422
```typescript
const res = await fetch('/api/sessions/synthesize', { method: 'POST' });
if (res.status === 422) {
  toast.error('Set your Anthropic API key in Settings to use AI features.');
  return;
}
```

---

## 🗄️ DATABASE

### Supabase Connection (Transaction mode — required)
```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false }); // prepare: false required
export const db = drizzle(client, { schema });
```

### Key Schema Facts
- All tables use `uuid().defaultRandom().primaryKey()`
- Soft deletes via `deletedAt` timestamp — never hard delete
- `sessions` has both `transcript_text` (pasted transcript) AND `notes` (FDE's own observations)
- `SystemEntry` JSONB has `detailNotes: string` for column/sheet/mapping capture
- `processModels.systems` is `SystemEntry[]` stored as JSONB

### Query Layer Pattern
Every entity has a file in `lib/db/queries/[entity].ts` with: `create`, `list` (with filters), `getById`, `update`, `softDelete`. No business logic in query files — pure DB operations only.

---

## 🤖 AI PATTERNS

### Pattern A: Structured Output
```typescript
import { generateObject } from 'ai';
const { model } = await getAIConfig('hypothesis');
const { object } = await generateObject({
  model,
  schema: z.object({ ... }),
  maxTokens: 2000,
  system: 'System prompt',
  prompt: 'User prompt',
});
```

### Pattern B: Text (plain prose or email)
```typescript
import { generateText } from 'ai';
const { model } = await getAIConfig('research');
const { text } = await generateText({ model, maxTokens: 1500, system: '...', prompt: '...' });
```

### Pattern C: Text + Web Search
```typescript
const { model, anthropic } = await getAIConfig('research');
const { text } = await generateText({
  model,
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  maxSteps: 3,
  ...
});
```

### Pattern D: Streaming Chat (research panel only)
```typescript
// API route — cannot use getAIConfig (streaming needs direct access)
import { streamText, convertToModelMessages } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { currentUser } from '@clerk/nextjs/server';

const user = await currentUser();
const apiKey = (user?.privateMetadata as any)?.anthropicApiKey;
if (!apiKey) return new Response(JSON.stringify({ error: 'No API key' }), { status: 422 });
const anthropic = createAnthropic({ apiKey });
const modelId = (user?.publicMetadata as any)?.aiModels?.research || 'claude-sonnet-4-20250514';

const result = streamText({
  model: anthropic(modelId),
  messages: await convertToModelMessages(messages),
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  maxSteps: 5,
  system: '...',
});
return result.toUIMessageStreamResponse();

// Client component
const { messages, sendMessage, status } = useChat({ api: '/api/ai/research' });
```

### Context Builder (L1 + L2 + L3)
Every synthesis/hypothesis call uses layered context:
- **L1:** Domain JSON from `lib/domain/l1/[type].json` — industry patterns, typical steps
- **L2:** Client + process data from DB
- **L3:** Session-specific data (interview answers, events)

Always include both `transcriptText` AND `notes` in synthesis prompts:
```
Transcript: ${session.transcriptText ?? 'No transcript provided'}
FDE personal notes: ${session.notes ?? 'No personal notes'}
```

---

## 🔌 API ROUTE PATTERN

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';

// Dynamic routes — ALWAYS await params (Next.js 15)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params; // await is required
    // ...
    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = mySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await createSomething(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### `handleAPIError` maps:
- `'NO_API_KEY'` → 422 with helpful message
- `'Unauthorized'` → 401
- `'Forbidden: admin role required'` → 403
- Anthropic `invalid_api_key` → 422
- `rate_limit` → 429
- Everything else → 500

---

## 🧪 TEST-FIRST WORKFLOW (MANDATORY)

For every feature, in this exact order:
1. Write the test describing the expected behavior
2. Run it — confirm it **FAILS (RED)**
3. Implement the minimum code to pass
4. Run full test suite
5. Refactor if needed

**Never skip step 2.** A test that was never red doesn't prove anything.

### Test Patterns

```typescript
// Unit test (Vitest)
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/auth/utils', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'test', role: 'admin' }),
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test', role: 'admin' }),
}));

// Integration test — call route handler directly, mock DB
// E2E (Playwright) — real browser, real DB interactions
```

---

## 📁 FILE CONVENTIONS

```
src/
├── app/
│   ├── (auth)/sign-in/[[...sign-in]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar + breadcrumb
│   │   └── clients/[clientId]/...        # All protected pages
│   ├── api/                              # All API routes
│   └── layout.tsx                        # Root (ClerkProvider)
├── components/
│   ├── ui/                               # shadcn (auto-generated, never edit)
│   ├── layout/                           # sidebar, breadcrumb, research panel
│   ├── clients/ processes/ sessions/     # Feature components
│   └── shared/                           # confirm-dialog, status-badge, etc.
├── lib/
│   ├── db/
│   │   ├── index.ts                      # Drizzle client
│   │   ├── schema.ts                     # All table definitions + Zod schemas
│   │   ├── types.ts                      # JSONB type interfaces
│   │   └── queries/[entity].ts           # Query functions per entity
│   ├── ai/
│   │   ├── get-ai-config.ts              # Per-user key + model resolver
│   │   ├── prompts/[feature].ts          # AI call functions
│   │   └── schemas/[feature].ts          # Zod schemas for AI output
│   ├── domain/l1/                        # L1 domain JSON files
│   ├── auth/utils.ts                     # requireAdmin, requireAuth, handleAPIError
│   ├── supabase/storage.ts               # Supabase storage client (files only)
│   └── hooks/                            # SWR hooks: use-clients.ts, etc.
```

**Naming:** kebab-case for files, PascalCase for components, camelCase for functions.

---

## ⚙️ SETTINGS PAGE (Phase 0)

The Settings page must be built in Phase 0. It's a dependency for all AI features.

### What it does:
1. **API Key section** — input to enter Anthropic key → saves to Clerk `privateMetadata` via `/api/settings/api-key`
2. **Test Key button** — calls `/api/settings/test-key` to verify the key works
3. **Model selection** — 5 dropdowns (research, hypothesis, suggestions, synthesis, interview) → saves to Clerk `publicMetadata`

### Clerk metadata structure:
```json
// privateMetadata (server-side only, encrypted):
{ "anthropicApiKey": "sk-ant-..." }

// publicMetadata (readable client-side):
{
  "role": "admin",
  "hasApiKey": true,
  "aiModels": {
    "research": "claude-sonnet-4-20250514",
    "hypothesis": "claude-sonnet-4-20250514",
    "suggestions": "claude-haiku-3-5-20241022",
    "synthesis": "claude-sonnet-4-20250514",
    "interview": "claude-sonnet-4-20250514"
  }
}
```

### Available models for Settings dropdowns:
| Model ID | Label |
|----------|-------|
| `claude-haiku-3-5-20241022` | Haiku 3.5 (fast, cheap) |
| `claude-sonnet-4-20250514` | Sonnet 4 (balanced) |
| `claude-opus-4-20250414` | Opus 4 (most capable) |

---

## 🚨 CRITICAL GOTCHAS

1. **`prepare: false`** on postgres client — required for Supabase connection pooler (Transaction mode)
2. **`await params`** in every dynamic API route — Next.js 15 breaking change
3. **`useChat` uses `sendMessage`** not `append` — AI SDK v4 API change
4. **Supabase new API keys** — use `publishable` key as `NEXT_PUBLIC_SUPABASE_URL` companion, `secret` key as `SUPABASE_SERVICE_ROLE_KEY`; no anon key needed since we're server-side only for storage
5. **Capture page bypasses layout** — uses `fixed inset-0`, not inside `(dashboard)` layout
6. **Suggestions must never crash capture** — if `NO_API_KEY` or any error on suggestions route, return `{ suggestions: [] }` silently
7. **Both transcript AND notes** feed into every synthesis call — never omit either
8. **SYSTEM event detail notes** stored in `event.detail` field, aggregated into `SystemEntry.detailNotes` during synthesis

---

## 📝 SPEC.md UPDATE PROTOCOL

After every completed step, update `SPEC.md`:
1. Mark the step as `[x]` in the phase checklist
2. Update "Current State" section (current phase + last completed step)
3. Update "Next Step" 
4. Add any new architectural decisions or discovered constraints to "Known Decisions"

Do NOT modify `CLAUDE.md` unless explicitly instructed.

---

## 🔗 DOCUMENT INDEX

| File | Read When |
|------|-----------|
| `CLAUDE.md` | Every session start |
| `SPEC.md` | Every session start |
| `docs/00-IMPLEMENTATION-PLAN.md` | Phase overview, architecture decisions |
| `docs/01-PHASE-0-SETUP.md` | During Phase 0 |
| `docs/02-PHASE-1-DATABASE.md` | During Phase 1 |
| `docs/03-PHASE-2-CLIENTS.md` | During Phase 2 |
| `docs/04-PHASE-3-PROCESSES.md` | During Phase 3 |
| `docs/05-PHASE-4-SESSIONS.md` | During Phase 4 |
| `docs/06-PHASE-5-SHADOWING.md` | During Phase 5 |
| `docs/07-PHASE-6-DEBRIEF-SYNTHESIS.md` | During Phase 6 |
| `docs/08-PHASE-7-POLISH.md` | During Phase 7 |
| `docs/09-TECH-REFERENCE.md` | Any time you need pattern reference |

---

## ✅ COMMIT CONVENTION

```
feat(clients): add client creation form
test(clients): add client creation API tests
fix(sessions): handle empty transcript in synthesis
chore(db): add notes column to sessions migration
```