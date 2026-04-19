# FDE Discovery Tool — Claude Code Instructions

> This file is the single source of truth for every Claude Code session.
> Read it fully at the start of every session, every time.

Two companion files sit next to it and must be read on every session start:

- `SPEC.md` — current phase, last completed step, next step, open decisions.
- `CONTRIBUTING.md` — Traza-wide frontend conventions this repo inherits (module layout, services, SWR keys, shadcn, "no `useEffect` for data fetching", etc.). Every rule in `CONTRIBUTING.md` applies here unless this file explicitly overrides it.

---

## 🔴 SESSION START RITUAL (MANDATORY — NO EXCEPTIONS)

Before writing a single line of code, do all of these:

1. **Read `SPEC.md`** — understand current state, what's done, what's next.
2. **Read the current phase doc** (`docs/01-PHASE-0-SETUP.md`, etc.).
3. **Skim `CONTRIBUTING.md`** if you haven't this session — the module-first architecture and SWR key rules are enforced below.
4. **State your plan** in exactly this format:

```
PLAN FOR THIS SESSION:
- Building: [1 sentence — what feature/step]
- Files I will CREATE: [list]
- Files I will MODIFY: [list]
- Files I will NOT touch: [list]
- Done looks like: [1 sentence — testable outcome]
```

5. **STOP. Wait for explicit approval before writing any code.**

If you start writing code before approval, stop immediately.

---

## 🛠️ AVAILABLE MCP TOOLS

You have direct access to two MCP servers. **Use them — don't ask to run commands manually.**

### Neon (Postgres)
Managed serverless Postgres. Two connection strings are required:
- `DATABASE_URL` — direct (unpooled) URL, used by `drizzle-kit` for migrations.
- `DATABASE_POOLED_URL` — pooled (`-pooler` hostname, PgBouncer Transaction mode), used by the app at runtime via `src/lib/db/index.ts`.

Use `npm run db:push` after schema changes. Inspect data via the Neon SQL editor or `psql` against the direct URL.

### Clerk MCP
Use for user/auth operations during development:
- **Set user metadata** — set `role: admin` on Alberto's user, set `hasApiKey: true` after testing
- **Read user metadata** — verify `publicMetadata` and `privateMetadata` are structured correctly
- **Create test users** — create viewer-role users for testing permission boundaries
- **Inspect sessions** — debug auth issues

### Rule: Prefer MCP over CLI
If an operation can be done via MCP, do it via MCP. Don't instruct Alberto to run `drizzle-kit push` in the terminal if you can execute the migration directly. Don't ask him to update Clerk metadata in the dashboard if you can do it via MCP.

---

## 🏗️ ARCHITECTURE (Never Violate)

### Stack
- **Framework:** Next.js 16 (App Router, `src/` dir, TypeScript, no semicolons)
- **UI:** shadcn/ui (New York style, Zinc) + AI Elements. Native HTML primitives (`<button>`, `<input>`, `<select>`, `<textarea>`) are banned — always use `@/components/ui/*`.
- **ORM:** Drizzle — ALL DB access via `src/lib/db/queries/<entity>.ts`. No raw SQL.
- **Auth:** Clerk — enforced in route handlers via `requireUserId`/`requireAdmin` (no `middleware.ts`).
- **Database:** Neon Postgres (direct URL for migrations, pooled URL for runtime).
- **Storage:** Vercel Blob for artifacts. **Blob URLs are never returned to the client** — always proxy through an auth-checked API route (see `/api/clients/[id]/processes/[processId]/artifacts/[artifactId]/download`).
- **AI:** Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic`). No server `ANTHROPIC_API_KEY`; every AI call uses the user's key from Clerk `privateMetadata`.
- **Data fetching:** SWR only. **Never use `useEffect` for data fetching** (see `CONTRIBUTING.md` → "React Hooks & Patterns").
- **Testing:** Vitest (unit/integration) + Playwright (E2E). Tests live centrally under `src/__tests__/` and mirror the `src/` tree.
- **Deploy:** Vercel.

### Hard Rules
- `await params` in every dynamic route — Next.js 16 makes `params` a `Promise`.
- `requireAdmin()` on every write route, `requireUserId()` on every read route.
- `handleAPIError(error)` in every API route `catch` — never return raw error messages.
- `parseJSON(req)` from `lib/api/utils.ts` for every body read — `req.json()` throws on malformed input.
- `generateObject()` for structured AI output, `generateText()` for prose, `streamText()` for chat.
- One query function per operation — no fat functions combining multiple concerns.

---

## 📦 MODULE ARCHITECTURE (Hard Rules — from `CONTRIBUTING.md`)

Client-side domain code lives under `src/modules/<domain>/`. Server-only code (Drizzle queries, AI prompts, `get-ai-config`, route handlers, `auth/utils`) stays under `src/lib/` and `src/app/api/`.

```
src/modules/<domain>/
├── components/        # Domain UI (uses @/components/ui/* for primitives)
├── hooks/             # SWR hooks — read from the module's service, key from swr-keys.ts
├── lib/
│   └── swr-keys.ts    # KEY factories + MATCH predicates (only if module has multiple keys)
├── services/          # Class-based singleton built on apiClient
├── types/             # Re-exports from lib/db/schema + module-local types
└── constants/ utils/  # (optional) domain constants / pure helpers
```

Current modules: `clients`, `contacts`, `processes`, `sessions`, `capture`, `debrief`, `research`, `artifacts`, `ai`, `settings`. New domain code **must** follow this shape.

### Services (class-based singleton)

Every module's API surface lives in `services/<domain>-service.ts`. Never call `fetch()` from a hook or component — always go through the service → `apiClient`.

```typescript
// src/modules/clients/services/clients-service.ts
import { apiClient } from '@/lib/api-client'
import type { Client, ClientCreate } from '@/modules/clients/types'

class ClientsService {
  private readonly basePath = '/api/clients'

  async list(filters?: ClientFilters): Promise<Client[]> {
    return apiClient.get<Client[]>(this.basePath, filters)
  }
  async getById(id: string): Promise<Client> {
    return apiClient.get<Client>(`${this.basePath}/${id}`)
  }
  async create(data: ClientCreate): Promise<Client> {
    return apiClient.post<Client>(this.basePath, data)
  }
  // ...
}

export const clientsService = new ClientsService()
```

`apiClient` (`src/lib/api-client.ts`) normalises errors into typed classes: `UnauthorizedError` (401), `ApiKeyMissingError` (422 NO_API_KEY), `ApiError` (everything else). Catch those in hooks — don't read `res.status` directly.

### SWR keys: factories + match predicates

Modules with more than one related cache key (`clients`, `contacts`, `processes`, `sessions`, `artifacts`, `ai`) define them centrally in `lib/swr-keys.ts`. **Inline string keys in hooks are a code smell.**

```typescript
// src/modules/processes/lib/swr-keys.ts
export const PROCESS_KEYS = {
  list:   (clientId: string)                 => `/api/clients/${clientId}/processes` as const,
  detail: (clientId: string, processId: string) =>
    `/api/clients/${clientId}/processes/${processId}` as const,
}

export const PROCESS_MATCH = {
  allRelated: (clientId: string) => (key: unknown) =>
    typeof key === 'string' && key.startsWith(`/api/clients/${clientId}/processes`),
}
```

In hooks: `useSWR(PROCESS_KEYS.list(clientId), () => processesService.list(clientId))`.
In mutation handlers: `mutate(PROCESS_MATCH.allRelated(clientId), undefined, { revalidate: true })` via `useSWRConfig()` — `globalMutate` from `swr` only accepts string keys.

### Client/server boundary
- `src/modules/**` is **client-side only**. Never import `@/lib/db`, `@/lib/ai/get-ai-config`, or `server-only` code from a module.
- `src/lib/db/queries/**`, `src/lib/ai/**`, `src/lib/auth/**`, `src/app/api/**` are **server-only**.

---

## 🔑 PER-USER AI KEYS (Critical Pattern)

There is **no** `ANTHROPIC_API_KEY` in `.env`. Each user stores their own key in Clerk `privateMetadata`.

### The helper (`src/lib/ai/get-ai-config.ts`)
- Reads `privateMetadata.anthropicApiKey` → throws `NO_API_KEY` if missing.
- Reads `publicMetadata.aiModels[feature]` → falls back to `DEFAULT_MODELS` from `src/lib/ai/models.ts`.
- Returns `{ model, modelId, anthropic }` — `anthropic` is exposed so callers can attach tools (e.g. `anthropic.tools.webSearch_20250305()`).

### Current model defaults (`src/lib/ai/models.ts`)
| Feature       | Default model                |
|---------------|------------------------------|
| `research`    | `claude-sonnet-4-6`          |
| `hypothesis`  | `claude-sonnet-4-6`          |
| `suggestions` | `claude-haiku-4-5-20241022`  |
| `synthesis`   | `claude-sonnet-4-6`          |
| `interview`   | `claude-sonnet-4-6`          |

`AVAILABLE_MODELS` in the same file is the list surfaced in the Settings dropdowns — update both together when adding a model.

### Usage pattern
```typescript
// Structured output
const { model } = await getAIConfig('hypothesis')
const { object } = await generateObject({ model, schema: mySchema, ... })

// Text with web search
const { model, anthropic } = await getAIConfig('research')
const { text } = await generateText({
  model,
  tools: { web_search: anthropic.tools.webSearch_20250305() },
  stopWhen: stepCountIs(3), // AI SDK v6 — not maxSteps
  ...
})
```

### Error handling (always)
```typescript
try {
  const { model } = await getAIConfig('synthesis')
  // ... AI call
} catch (error) {
  return handleAPIError(error) // NO_API_KEY → 422, Unauthorized → 401, etc.
}
```

### Frontend: handle 422
```typescript
try {
  await service.synthesize(sessionId)
} catch (err) {
  if (err instanceof ApiKeyMissingError) {
    toast.error('Set your Anthropic API key in Settings to use AI features.')
    return
  }
  throw err
}
```

### Streaming (research panel only)
`streamText` needs request context, so it cannot use `getAIConfig` — resolve the key and model inline in the route handler. See `src/app/api/ai/research/route.ts` for the canonical pattern (client uses `useChat` with `DefaultChatTransport({ api, body })` — v6 no longer accepts an `api` option).

### Suggestions never crash capture
`/api/ai/suggestions` must catch **all** errors (NO_API_KEY, rate limits, network, anything) and return `{ suggestions: [] }`. The capture UI must never break because AI failed.

---

## 🗄️ DATABASE

### Neon connection (pooled at runtime, direct for migrations)
```typescript
// src/lib/db/index.ts — runtime uses the pooled URL (PgBouncer Transaction mode)
const client = postgres(env.DATABASE_POOLED_URL, { prepare: false }) // prepare: false REQUIRED
export const db = drizzle(client, { schema })
```
`drizzle.config.ts` reads `DATABASE_URL` (direct/unpooled) for DDL.

### Key schema facts
- All tables: `uuid().defaultRandom().primaryKey()`.
- Soft deletes via `deletedAt` timestamp — never hard delete. (Exceptions: `eventLogs` is immutable; `processModels` has no `deletedAt` yet — tech debt.)
- `sessions` owns `clientId` (NOT NULL). Optional links to processes via `session_process_links` M:M. Legacy `sessions.processId` is nullable. UI path: `/clients/[clientId]/sessions/[sessionId]`.
- `sessions.transcript_text` (pasted transcript) AND `sessions.notes` (FDE's own observations) — both feed synthesis. Never omit either.
- `processModels.systems: SystemEntry[]` is JSONB. `SystemEntry.detailNotes` is free text for column/sheet/mapping capture and is **appended** (not replaced) with `\n---\n` on merge (see `mergeSystems` in `src/lib/utils/merge-process-model.ts`).

### Query layer pattern
Every entity has `src/lib/db/queries/<entity>.ts` exposing `create`, `list` (with filters), `getById`, `update`, `softDelete`. Pure DB operations only — no business logic. Inside a `db.transaction`, use `tx.update()` directly; standalone query fns use the outer `db` instance and break atomicity.

---

## 🤖 AI PATTERNS

### Pattern A: Structured Output
```typescript
import { generateObject } from 'ai'
const { model } = await getAIConfig('hypothesis')
const { object } = await generateObject({
  model,
  schema: z.object({ ... }),
  maxOutputTokens: 2000, // AI SDK v6 — NOT maxTokens
  system: 'System prompt',
  prompt: 'User prompt',
})
```

### Pattern B: Text (prose or email)
```typescript
import { generateText } from 'ai'
const { model } = await getAIConfig('research')
const { text } = await generateText({ model, maxOutputTokens: 1500, system: '...', prompt: '...' })
```

### Pattern C: Text + Web Search
```typescript
const { model, anthropic } = await getAIConfig('research')
const { text } = await generateText({
  model,
  tools: { web_search: anthropic.tools.webSearch_20250305() as any }, // cast required
  stopWhen: stepCountIs(3),
  ...
})
```

### Pattern D: Streaming chat
See `src/app/api/ai/research/route.ts`. Key points:
- `streamText` + `result.toUIMessageStreamResponse()`.
- `await convertToModelMessages(messages)` — it returns a Promise in v6.
- Client: `useChat({ transport: new DefaultChatTransport({ api, body }) })`.

### Layered context (L1 + L2 + L3)
Every synthesis/hypothesis call assembles context in layers:
- **L1:** Domain JSON from `src/lib/domain/l1/<type>.json` — industry patterns, typical steps.
- **L2:** Client + process data from DB.
- **L3:** Session data (interview answers, events, debrief answers).

Always include both `transcriptText` AND `notes` in synthesis prompts:
```
Transcript: ${session.transcriptText ?? 'No transcript provided'}
FDE personal notes: ${session.notes ?? 'No personal notes'}
```

### Fire-and-forget AI
When you trigger AI after returning a response (e.g. `triggerProcessHypothesis`), resolve the model **eagerly** inside the request handler and pass it down — `getAIConfig` calls `auth()` which requires request context. Also: write derived data (e.g. `steps`) **before** the field the UI polls on (e.g. `hypothesisText`), so polling clients don't see half-populated state.

---

## 🔌 API ROUTE PATTERN

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { parseJSON } from '@/lib/api/utils'

// Dynamic routes — ALWAYS await params
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUserId()
    const { id } = await params
    const result = await getThing(id)
    return NextResponse.json(result)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { data, error } = await parseJSON(req)
    if (error) return error
    const parsed = mySchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const result = await createSomething(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleAPIError(error)
  }
}
```

### `handleAPIError` maps
| Thrown / matched                           | Status | Notes |
|--------------------------------------------|--------|-------|
| `'NO_API_KEY'`                             | 422    | Friendly "Go to Settings" message |
| `'Unauthorized'`                           | 401    | From `requireUserId` |
| `'Forbidden: admin role required'`         | 403    | From `requireAdmin` |
| error message includes `'invalid_api_key'` | 422    | |
| error message includes `'rate_limit'`      | 429    | |
| anything else                              | 500    | `'Internal server error'` |

### Validation order gotcha
When a route references a parent entity by param, check the parent **exists** before parsing the body — e.g. contact `POST` returns 404 for a nonexistent client regardless of body shape.

---

## 🧪 TEST-FIRST WORKFLOW (MANDATORY)

Tests live under `src/__tests__/`, mirroring the `src/` tree (`src/__tests__/modules/clients/clients-service.test.ts`, `src/__tests__/api/...`, etc.).

For every feature, in this exact order:
1. Write the test describing the expected behavior.
2. Run it — confirm it **FAILS (RED)**.
3. Implement the minimum code to pass.
4. Run full test suite.
5. Refactor if needed.

**Never skip step 2.** A test that was never red doesn't prove anything.

```typescript
// Typical unit-test setup
import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/auth/utils', () => ({
  requireUserId:  vi.fn().mockResolvedValue('test-user'),
  requireAdmin:   vi.fn().mockResolvedValue({ userId: 'test', role: 'admin' }),
  handleAPIError: (await vi.importActual('@/lib/auth/utils') as any).handleAPIError,
}))
```

- Integration tests call route handlers directly and mock `@/lib/db/queries/*`.
- E2E tests use Playwright with a real browser. Clerk programmatic sign-in (`@clerk/testing` 2.0.1) is currently broken with Next.js 16 `proxy.ts` — document any workaround in `SPEC.md`.
- Use `crypto.randomUUID()` for test UUIDs; Zod v4 rejects `00000000-...`.

---

## 📁 FILE CONVENTIONS

```
src/
├── app/
│   ├── (auth)/sign-in/[[...sign-in]]/page.tsx
│   ├── (capture)/...                     # Full-screen route group (no dashboard chrome)
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar + breadcrumb
│   │   └── clients/[clientId]/...        # All protected pages
│   ├── api/                              # All API routes (server-only)
│   └── layout.tsx                        # Root (ClerkProvider)
├── components/
│   ├── ui/                               # shadcn (auto-generated — never hand-edit)
│   ├── layout/                           # sidebar, breadcrumb, header
│   ├── providers/                        # SWRProvider etc.
│   └── shared/                           # confirm-dialog, collapsible-card, ...
├── lib/
│   ├── api-client.ts                     # Typed HTTP client (used by services)
│   ├── api/utils.ts                      # parseJSON for route handlers
│   ├── auth/utils.ts                     # requireUserId, requireAdmin, requireAuthWithUser, handleAPIError
│   ├── ai/
│   │   ├── get-ai-config.ts              # Per-user key + model resolver
│   │   ├── models.ts                     # AVAILABLE_MODELS + DEFAULT_MODELS
│   │   ├── prompts/<feature>.ts          # AI call functions
│   │   └── schemas/<feature>.ts          # Zod schemas for AI output
│   ├── db/
│   │   ├── index.ts                      # Drizzle client
│   │   ├── schema.ts                     # Tables + Zod schemas
│   │   ├── types.ts                      # JSONB type interfaces
│   │   └── queries/<entity>.ts           # Pure DB ops (server-only)
│   ├── domain/l1/                        # L1 domain JSON
│   ├── hooks/                            # Truly cross-cutting hooks (e.g. use-role)
│   ├── storage/                          # Vercel Blob helpers (artifacts)
│   ├── utils/                            # Pure utilities (merge-process-model etc.)
│   ├── env.ts                            # Validated env access
│   └── utils.ts                          # `cn()` and other global helpers
├── modules/                              # 🎯 Client-side domain code (see Module Architecture)
│   ├── clients/     contacts/   processes/   sessions/
│   ├── capture/     debrief/    research/    artifacts/
│   ├── ai/          settings/
└── __tests__/                            # Mirrors src/ — vitest
```

**Naming:** kebab-case for files, PascalCase for components, camelCase for functions, UPPER_SNAKE_CASE for constants.
**Style:** no semicolons (Prettier), single quotes, 100-char line width. Run `npm run format` if your editor doesn't auto-format.

---

## ⚙️ SETTINGS PAGE (Phase 0 — dependency for all AI)

Implemented at `/settings`. Three concerns:
1. **API key** — input → `POST /api/settings/api-key` writes to Clerk `privateMetadata`.
2. **Test key** — `POST /api/settings/test-key` makes a minimal Anthropic call to verify the key.
3. **Model selection** — 5 dropdowns (one per `AIFeature`) → writes to Clerk `publicMetadata.aiModels`.

```json
// privateMetadata (server-side only, encrypted)
{ "anthropicApiKey": "sk-ant-..." }

// publicMetadata (readable client-side)
{
  "role": "admin",
  "hasApiKey": true,
  "aiModels": {
    "research": "claude-sonnet-4-6",
    "hypothesis": "claude-sonnet-4-6",
    "suggestions": "claude-haiku-4-5-20241022",
    "synthesis": "claude-sonnet-4-6",
    "interview": "claude-sonnet-4-6"
  }
}
```

Model options live in `src/lib/ai/models.ts` (`AVAILABLE_MODELS`). Update that file when adding a model — dropdowns, defaults, and validation all read from it.

---

## 🚨 CRITICAL GOTCHAS

1. **`prepare: false`** on postgres client — required for Neon pooler (PgBouncer Transaction mode).
2. **`await params`** in every dynamic API route — Next.js 16 breaking change.
3. **AI SDK v6**: `maxOutputTokens` (not `maxTokens`), `stopWhen: stepCountIs(n)` (not `maxSteps`), `convertToModelMessages` is async, `useChat` takes `transport: new DefaultChatTransport({ api, body })` (no `api` option).
4. **SWR v2**: `globalMutate` from `swr` only accepts string keys. For function matchers (e.g. `PROCESS_MATCH.allRelated`), use `useSWRConfig().mutate`.
5. **shadcn v4** has no `asChild`/`render` on `Button`/`PopoverTrigger`. Use `buttonVariants()` with `Link` directly, or swap to `Dialog`.
6. **Vercel Blob URLs are public.** `put({ access: 'public' })` is the only supported option. Always proxy downloads through an auth-checked route — never return the raw blob URL to the client.
7. **Capture page bypasses the dashboard layout** — lives under `(capture)` route group, full-screen (`fixed inset-0`). Use a hard navigation to leave it.
8. **Suggestions must never crash capture** — `/api/ai/suggestions` returns `{ suggestions: [] }` on any error.
9. **Both transcript AND notes** feed every synthesis call — never omit either.
10. **SYSTEM event detail notes** are stored in `event.detail` and aggregated into `SystemEntry.detailNotes` during synthesis with a `\n---\n` separator.
11. **No `middleware.ts`** — auth is enforced per route via `requireUserId`/`requireAdmin`.
12. **Fire-and-forget AI** — resolve the model eagerly in the handler and write derived fields before the field the UI polls on.
13. **Never copy server data into `useState`.** Use the SWR return directly; don't re-sync with `useEffect`. (See `CONTRIBUTING.md` → "Common Pitfalls".)
14. **URL state** (filters, tabs) uses `nuqs`, not `useState + router.push`.

---

## 📝 SPEC.md UPDATE PROTOCOL

After every completed step, update `SPEC.md`:
1. Mark the step `[x]` in the phase checklist.
2. Update "Current State" (current phase + last completed step).
3. Update "Next Step".
4. Add any new architectural decisions or discovered constraints to "Known Decisions".
5. Append one row to "Session Log".

Do NOT modify `CLAUDE.md` unless explicitly instructed.

---

## 🔗 DOCUMENT INDEX

| File | Read when |
|------|-----------|
| `CLAUDE.md` | Every session start |
| `SPEC.md` | Every session start |
| `CONTRIBUTING.md` | Every session start (conventions this repo inherits) |
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
| `docs/plans/*.md` | Active redesign/refactor plans (client research, AI layer, etc.) |

---

## ✅ COMMIT CONVENTION

```
feat(clients): add client creation form
test(clients): add client creation API tests
fix(sessions): handle empty transcript in synthesis
chore(db): add notes column to sessions migration
refactor(processes): move swr keys to lib/swr-keys.ts
```

One feature/fix per PR. Refactors in separate PRs. Run `npm run lint` before committing.
