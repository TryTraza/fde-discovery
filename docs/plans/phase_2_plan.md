# Phase 2 — Client CRUD + Company Research (FINAL v4)

## Fourth Review Summary

The v3 plan was ~97% production-ready. **4 additional gaps remained** that would cause runtime failures or subtle bugs. This review preserves the v3 structure and patches each gap inline. Changes marked with `🔧 FIX4` for corrections and `🆕 ADD4` for missing pieces.

### Additional Gaps Found (v4)

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 19 | `globalMutate` imported from `swr` does NOT accept a filter function in SWR v2 — `mutateClients()` silently fails or throws a TypeScript error. Only `useSWRConfig().mutate` supports function matchers. | **Critical** | Rewrote `use-clients.ts` to use `useSWRConfig().mutate` internally. Hook must be called inside `<SWRProvider>`. |
| 20 | Contact POST route checks client existence before parsing body — correct, but the test table lists both "nonexistent client → 404" and "invalid body → 400" without clarifying which wins when both conditions are true. A junior may reorder the checks. | Low | Added explicit note to test table: client check runs first, so nonexistent client always returns 404 regardless of body validity. |
| 21 | `mutateClients` key matcher `k.startsWith('/api/clients')` also matches `/api/clients/{id}/contacts` keys — causes over-revalidation of contacts cache on client list mutations. Not a bug but can cause confusion if someone later "optimizes" the matcher. | Low | Added inline comment documenting intentional over-revalidation and warning not to narrow the matcher without understanding cross-key dependencies. |
| 22 | `company-research.test.ts` test scenarios don't explicitly require asserting that `updateClient` is called with the AI-generated text. A junior might only assert `generateText` was called and miss verifying the persistence step. | Medium | Added explicit test assertion: `expect(updateClient).toHaveBeenCalledWith(clientId, { aiSummary: expect.any(String) })` |

---

## Context

Phase 1 (Database Schema & ORM) is complete. The query layer for all 8 entities exists, including `clients.ts` and `contacts.ts` with full CRUD. Auth utilities (`requireUserId`, `requireAdmin`, `handleAPIError`) are in place. The AI config system (`getAIConfig`) reads per-user API keys from Clerk metadata. The `/clients` page is currently a placeholder. No API routes exist for clients or contacts yet. SWR is not installed.

**Goal:** Full client management — CRUD API routes, list/detail pages, AI company research, contacts CRUD, SWR hooks.

---

## Execution Order

Reordered from SPEC.md to respect dependencies. SWR hooks (2.8) move before UI pages. Contacts CRUD (2.7) moves before the overview page (2.6) since it displays contacts.

```
2.1 → 2.2 → 2.3 → 2.8 → 2.4 → 2.5 → 2.7 → 2.6
```

**Pre-requisite: Install SWR**

```bash
npm install swr
```

---

## Step 2.1 — Client API Route Tests (RED)

**Purpose:** Write all tests first. They must all FAIL (no routes exist yet).

**Create:**
- `src/__tests__/api/clients.test.ts` — tests for GET /api/clients + POST /api/clients
- `src/__tests__/api/clients-id.test.ts` — tests for GET/PATCH/DELETE /api/clients/[id]

**Test scenarios — `clients.test.ts`:**

| Test | Expected |
|------|----------|
| GET — unauthenticated | 401 |
| GET — returns client list | 200 + array |
| GET — passes search/status/industry filters | `listClients` called with parsed params |
| POST — unauthenticated | 401 |
| POST — viewer role | 403 |
| POST — invalid body (missing name) | 400 + `{ error: string, details?: Record<string, string[]> }` |
| POST — valid body | 201 + created client |
| POST — triggers `triggerCompanyResearch` fire-and-forget | function called, response does NOT wait for it |
| POST — malformed JSON body | 400 + `{ error: 'Invalid JSON' }` |

**Test scenarios — `clients-id.test.ts`:**

| Test | Expected |
|------|----------|
| GET — unauthenticated | 401 |
| GET — not found | 404 |
| GET — found | 200 + client with relations |
| PATCH — viewer role | 403 |
| PATCH — invalid body (empty name) | 400 |
| PATCH — not found (valid body, nonexistent id) | 404 |
| PATCH — success | 200 + updated client |
| PATCH — malformed JSON body | 400 + `{ error: 'Invalid JSON' }` |
| DELETE — viewer role | 403 |
| DELETE — not found | 404 |
| DELETE — success | 200 + `{ message: 'Client deleted' }` |

**Mock pattern** (follow `src/__tests__/api/settings.test.ts`):
- Mock `@clerk/nextjs/server` via `setupClerkMocks` from `src/__tests__/mocks/clerk.ts`
- Mock `@/lib/db/queries/clients` — all query functions
- Mock `@/lib/ai/prompts/company-research` — verify call without executing AI
- Use `@vitest-environment node` directive
- Pass params as `Promise<{ id: string }>` for dynamic routes

**Standardized error response shape:**

All 400 responses must follow this shape so UI can parse predictably:

```typescript
// Validation error:
{ error: "Validation failed", details: { name: ["Required"], website: ["Invalid url"] } }

// Malformed JSON:
{ error: "Invalid JSON" }
```

**Test helper for building Request objects:**

When testing POST/PATCH routes, the test must construct a `Request` with a JSON body. Ensure the mock pattern includes:

```typescript
// In test helpers or inline in each test:
function createRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// For malformed JSON test:
function createBadJsonRequest(method: string, url: string): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json',
  });
}
```

Without `Content-Type`, `request.json()` may behave unexpectedly in some environments. Follow the exact pattern used in `settings.test.ts` — check whether that file uses `new Request()` or a helper, and match it.

**🆕 ADD3 — Stub for `triggerCompanyResearch`:**

The POST test mocks `@/lib/ai/prompts/company-research`. For the mock to resolve correctly and for `npm run build` not to fail in Step 2.2, create a stub now:

```typescript
// src/lib/ai/prompts/company-research.ts (STUB — replaced in Step 2.3)
export async function triggerCompanyResearch(
  clientId: string,
  name: string,
  industry: string,
  website?: string
): Promise<void> {
  // Stub — implemented in Step 2.3
}
```

This ensures the import in the route handler resolves during build. The tests mock it anyway, so the stub body doesn't matter.

**Verify:** `npx vitest run src/__tests__/api/clients` — all tests RED (routes don't exist yet)

---

## Step 2.2 — Client API Routes (GREEN)

**Purpose:** Implement route handlers to turn tests GREEN.

**Create:**
- `src/app/api/clients/route.ts` — GET (list) + POST (create)
- `src/app/api/clients/[id]/route.ts` — GET (detail) + PATCH (update) + DELETE (soft delete)

**Implementation details:**

| Route | Auth | Query function | Notes |
|-------|------|---------------|-------|
| GET /api/clients | `requireUserId()` | `listClients(filters)` | Parse `search`, `status`, `industry` from URL params |
| POST /api/clients | `requireAdmin()` | `createClient(data)` | Custom Zod schema — only user-facing fields. Returns **201**. |
| GET /api/clients/[id] | `requireUserId()` | `getClientWithRelations(id)` | Return 404 if null |
| PATCH /api/clients/[id] | `requireAdmin()` | `updateClient(id, data)` | Partial schema, return 404 if null |
| DELETE /api/clients/[id] | `requireAdmin()` | `softDeleteClient(id)` | Return 404 if null |

**Key files to reuse:**
- `src/lib/db/queries/clients.ts` — all query functions already exist
- `src/lib/auth/utils.ts` — `requireUserId`, `requireAdmin`, `handleAPIError`
- `src/lib/ai/prompts/company-research.ts` — stub from Step 2.1

**Custom Zod schemas** (don't reuse `insertClientSchema` — it allows `id`, `createdAt`, etc.):

```typescript
import { z } from 'zod';

const createClientSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().url().optional().or(z.literal('')),
  hqLocation: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['prospecting', 'active_poc', 'demo_ready', 'closed']).optional(),
});

const updateClientSchema = createClientSchema.partial();
```

**🔧 FIX3 — Safe JSON parsing wrapper (fixes Gap #18):**

`await request.json()` throws `SyntaxError` on malformed input. Wrap it:

```typescript
async function parseJSON(request: Request): Promise<{ data?: unknown; error?: Response }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return {
      error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
}
```

Place this in a shared util (e.g., `src/lib/api/utils.ts`) or inline in each route file. Use it in every POST/PATCH handler.

**GET list — full implementation:**

```typescript
export async function GET(request: Request) {
  try {
    await requireUserId();
    const { searchParams } = new URL(request.url);
    const filters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      industry: searchParams.get('industry') || undefined,
    };
    const clients = await listClients(filters);
    return NextResponse.json(clients);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**POST — full implementation (🔧 FIX3: explicit 201 + safe JSON parse):**

```typescript
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = createClientSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const client = await createClient(parsed.data);

    // Fire-and-forget — do NOT await
    triggerCompanyResearch(client.id, client.name, client.industry, client.website ?? undefined);

    return NextResponse.json(client, { status: 201 }); // 🔧 FIX3: explicit 201
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**PATCH — full implementation:**

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = updateClientSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const client = await updateClient(id, parsed.data);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**DELETE — full implementation:**

```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await softDeleteClient(id);
    if (!result) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Client deleted' });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**🔧 FIX3 — `softDeleteClient` contract (fixes Gap #14):**

Before writing the route, **verify** the behavior of `softDeleteClient(id)` in `src/lib/db/queries/clients.ts`:

```bash
grep -A 10 'softDeleteClient' src/lib/db/queries/clients.ts
```

It MUST:
- Return `null` (or falsy) when the client doesn't exist
- Return the deleted record (or truthy) on success
- NOT throw on not-found

If it throws instead of returning null, you have two options:
1. Wrap in try/catch in the route (worse — hides real errors)
2. Fix the query function to use `.returning()` and check length (better)

The same applies to `updateClient(id, data)` — verify it returns `null` on not-found.

**PATCH 404 handling — important nuance:**

`updateClient(id, data)` must return `null` when the client doesn't exist (not throw). The route checks for `null` and returns 404. Verify that the query layer in `clients.ts` actually does this — if it throws on not-found, wrap in try/catch or adjust.

**Verify:** `npx vitest run src/__tests__/api/clients` — all tests GREEN

---

## Step 2.3 — Company Research AI

**Purpose:** AI function that researches a company using web search and writes result to `aiSummary`.

**Modify (replace stub):**
- `src/lib/ai/prompts/company-research.ts` — `triggerCompanyResearch(clientId, name, industry, website?)`

**Create:**
- `src/__tests__/ai/company-research.test.ts` — tests for the function
- `src/app/api/clients/[id]/research/route.ts` — POST endpoint for "Research more" button
- `src/__tests__/api/clients-id-research.test.ts` — tests for POST /api/clients/[id]/research

**Function behavior:**
1. `getAIConfig('research')` → gets user's key + model
2. `generateText()` with `anthropic.tools.webSearch_20250305()`, `maxSteps: 3`
3. `updateClient(clientId, { aiSummary: text })` on success
4. On `NO_API_KEY` → sets friendly message, does not throw
5. On any error → sets fallback message, does not throw

**Test scenarios for `company-research.test.ts`:**

| Test | Expected |
|------|----------|
| Calls `generateText` with web search tool on success | `generateText` called with correct params |
| Updates `aiSummary` with result text | `expect(updateClient).toHaveBeenCalledWith(clientId, { aiSummary: expect.any(String) })` — 🔧 FIX4: explicitly assert persistence, not just AI call |
| Handles `NO_API_KEY` gracefully | `updateClient` called with friendly "set your key" message, no throw |
| Handles generic errors gracefully | `updateClient` called with fallback message, no throw |

**🔧 FIX4 — Explicit persistence assertion (fixes Gap #22):**

Every test case for `triggerCompanyResearch` must assert BOTH:
1. That `generateText` was called (or not, in error cases)
2. That `updateClient(clientId, { aiSummary: ... })` was called with the expected content

A test that only checks `generateText` was called does NOT verify the function actually persisted the result. The persistence step is the entire point of the function.

Example test structure:

```typescript
it('updates aiSummary with research result on success', async () => {
  vi.mocked(getAIConfig).mockResolvedValue({ apiKey: 'test-key', model: 'test-model' });
  vi.mocked(generateText).mockResolvedValue({ text: 'Research result about Acme Corp' });

  await triggerCompanyResearch('client-1', 'Acme Corp', 'Tech', 'https://acme.com');

  // Assert AI was called
  expect(generateText).toHaveBeenCalledOnce();

  // 🔧 FIX4: Assert persistence — this is the critical check
  expect(updateClient).toHaveBeenCalledWith('client-1', {
    aiSummary: expect.stringContaining('Research result'),
  });
});

it('sets friendly message when no API key', async () => {
  vi.mocked(getAIConfig).mockResolvedValue({ apiKey: 'NO_API_KEY', model: '' });

  await triggerCompanyResearch('client-1', 'Acme Corp', 'Tech');

  expect(generateText).not.toHaveBeenCalled();

  // 🔧 FIX4: Assert the fallback message was persisted
  expect(updateClient).toHaveBeenCalledWith('client-1', {
    aiSummary: expect.stringContaining('Settings'),
  });
});
```

**Test scenarios for `clients-id-research.test.ts`:**

| Test | Expected |
|------|----------|
| POST — unauthenticated | 401 |
| POST — viewer role | 403 |
| POST — client not found | 404 |
| POST — success (client exists) | 200 + `{ message: 'Research started' }` |
| POST — triggers `triggerCompanyResearch` | function called with clientId, name, industry, website |

**Research route implementation:**

```typescript
// src/app/api/clients/[id]/research/route.ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const client = await getClientById(id); // Lightweight get — see note below
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    // Fire-and-forget
    triggerCompanyResearch(id, client.name, client.industry, client.website ?? undefined);
    return NextResponse.json({ message: 'Research started' });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**⚠️ Important — verify query function availability:**

The research route needs `getClientById(id)` (lightweight, just the client row). Verify that `clients.ts` exports this:

```bash
grep 'export.*getClient' src/lib/db/queries/clients.ts
```

If it only has `getClientWithRelations`, either:
- Use `getClientWithRelations` (heavier but works), or
- Add `getClientById` to the query layer (one-line function)

This same function is needed in Step 2.7 (contacts POST verifies parent client). Decide once, use consistently.

**Integration:** The POST `/api/clients` handler already calls `triggerCompanyResearch` (done in Step 2.2 using the stub).

**Risk — `maxTokens` vs `maxOutputTokens`:** The tech debt log says AI SDK v6 uses `maxOutputTokens`. Verify with:

```bash
grep -r "maxTokens\|maxOutputTokens" node_modules/ai/dist/ | head -5
```

Use whichever the installed version expects.

**Verify:** `npx vitest run src/__tests__/ai/company-research src/__tests__/api/clients-id-research` — all GREEN

---

## Step 2.8 — SWR Hooks (moved before UI)

**Purpose:** Thin client-side data fetching wrappers. All UI pages depend on these.

**Pre-requisite: SWRConfig provider**

Before any hook works correctly, the app needs a global `SWRConfig` provider. Without it, SWR still works but has aggressive defaults (refetch on focus causes flicker during inline editing, no shared error handling).

**Create:**
- `src/components/providers/swr-provider.tsx`

```typescript
'use client';

import { SWRConfig } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch');
    // Attach status so consumers can check error.status
    (error as any).status = res.status;
    try {
      (error as any).info = await res.json();
    } catch {
      // Response wasn't JSON — ignore
    }
    throw error;
  }
  return res.json();
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher,
      revalidateOnFocus: false, // Prevents flicker during inline editing
      dedupingInterval: 2000,   // Dedup identical requests within 2s
    }}>
      {children}
    </SWRConfig>
  );
}
```

**🆕 ADD3 — Error info on fetcher:** The original fetcher silently threw a generic `Error('Failed to fetch')`. This makes it impossible for UI components to distinguish 404 from 500. The updated fetcher attaches `.status` and `.info` to the error object. This is the [SWR recommended pattern](https://swr.vercel.app/docs/error-handling).

**Modify:** Add `<SWRProvider>` to the dashboard layout. Wrap it around the existing children, inside the Clerk provider but around page content.

Check the current layout file:

```bash
cat src/app/(dashboard)/layout.tsx
```

Add `<SWRProvider>` there. Example:

```typescript
import { SWRProvider } from '@/components/providers/swr-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SWRProvider>
      {/* existing sidebar/nav structure */}
      {children}
    </SWRProvider>
  );
}
```

**Create hooks:**
- `src/lib/hooks/use-clients.ts` — `useClients(filters?)`, `useClient(id)`
- `src/lib/hooks/use-contacts.ts` — `useContacts(clientId)`

**🔧 FIX4 — Corrected `use-clients.ts` (fixes Gap #19):**

The v3 plan imported `mutate as globalMutate` from `swr` and passed it a filter function. This does **NOT** work in SWR v2 — `globalMutate` from the `swr` package only accepts a string key, not a function matcher. Only `useSWRConfig().mutate` supports function matchers.

**Wrong (v3 — will fail silently or throw TS error):**

```typescript
// ❌ BROKEN — globalMutate does NOT accept a function in SWR v2
import { mutate as globalMutate } from 'swr';
// ...
mutateClients: () => globalMutate(
  (k) => typeof k === 'string' && k.startsWith('/api/clients'),
  undefined,
  { revalidate: true }
),
```

**Correct (v4):**

```typescript
// src/lib/hooks/use-clients.ts
import useSWR, { useSWRConfig } from 'swr';

interface ClientFilters {
  search?: string;
  status?: string;
  industry?: string;
}

export function useClients(filters?: ClientFilters) {
  // 🔧 FIX4: useSWRConfig().mutate supports function matchers; globalMutate does NOT
  const { mutate: swrMutate } = useSWRConfig();

  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.industry) params.set('industry', filters.industry);

  const key = `/api/clients?${params.toString()}`;
  const result = useSWR(key); // fetcher comes from SWRConfig provider

  return {
    ...result,
    clients: result.data ?? [],
    mutateClients: () => swrMutate(
      // 🔧 FIX4: Function matcher — revalidates ALL keys starting with /api/clients
      // This intentionally over-revalidates: it also hits /api/clients/{id} and
      // /api/clients/{id}/contacts keys. This is correct — after creating/deleting
      // a client, the detail page and contacts cache should also refresh.
      // ⚠️ Do NOT narrow this matcher without understanding cross-key dependencies.
      (k) => typeof k === 'string' && k.startsWith('/api/clients'),
      undefined,
      { revalidate: true }
    ),
  };
}

export function useClient(id: string | null) {
  const result = useSWR(id ? `/api/clients/${id}` : null);
  return {
    ...result,
    client: result.data ?? null,
    mutateClient: result.mutate, // Exposed for inline edit revalidation
  };
}
```

**Why `useSWRConfig().mutate` and not `globalMutate`?**

SWR v2 exports two `mutate` functions:
- `import { mutate } from 'swr'` — the **unbound** global mutate. Accepts only a **string key**. Cannot filter.
- `useSWRConfig().mutate` — the **bound** mutate from the nearest `<SWRConfig>` provider. Accepts a **function matcher** like `(key) => key.startsWith(...)`.

Since `useClients` must be called from within a component tree that has `<SWRProvider>`, `useSWRConfig()` is always available. This is the only correct way to use a function matcher in SWR v2.

**🔧 FIX4 — `use-contacts.ts` (same fix applied):**

```typescript
// src/lib/hooks/use-contacts.ts
import useSWR, { useSWRConfig } from 'swr';

export function useContacts(clientId: string | null) {
  const { mutate: swrMutate } = useSWRConfig();
  const key = clientId ? `/api/clients/${clientId}/contacts` : null;
  const result = useSWR(key); // fetcher comes from SWRConfig provider

  return {
    ...result,
    contacts: result.data ?? [],
    mutateContacts: () => {
      if (clientId) {
        // 🔧 FIX4: use bound mutate for consistency, though a string key works here too
        swrMutate(`/api/clients/${clientId}/contacts`);
      }
    },
  };
}
```

**No dedicated tests** — these are thin wrappers. Tested implicitly via component integration.

**Verify:** TypeScript compiles, hooks export correctly: `npx tsc --noEmit`

---

## Step 2.4 — Client List Page

**Purpose:** Replace the placeholder `/clients` page with a real data-driven list.

**Modify:**
- `src/app/(dashboard)/clients/page.tsx` — rewrite with real content

**Create:**
- `src/components/clients/client-list.tsx` — main list (client component, uses `useClients`)
- `src/components/clients/client-card.tsx` — card per client
- `src/components/clients/client-filters.tsx` — search input + status filter
- `src/components/clients/status-badge.tsx` — color-coded badge for client status enum

**Features:**
- Search bar (debounced, updates SWR key)
- Status filter dropdown
- Cards showing: name, industry, status badge, location, creation date
- Click card → navigate to `/clients/[clientId]`
- "New Client" button (opens creation dialog — step 2.5)
- Skeleton loading state
- Empty state
- `ApiKeyBanner` at top (already exists)

**shadcn components to use:** Card, Input, Badge, Skeleton, Select, Button

**Page structure — server/client split:**

```typescript
// src/app/(dashboard)/clients/page.tsx — Server Component (thin shell)
import { ClientList } from '@/components/clients/client-list';

export default function ClientsPage() {
  return <ClientList />;
}
```

```typescript
// src/components/clients/client-list.tsx — Client Component
'use client';
```

**Implementation note — debounce:**

```typescript
const [searchInput, setSearchInput] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
  return () => clearTimeout(timer);
}, [searchInput]);

const { clients, isLoading, mutateClients } = useClients({
  search: debouncedSearch,
  status: statusFilter,
});
```

**`mutateClients` must be available to the create dialog:**

The `client-list.tsx` component calls `useClients()` and gets `mutateClients`. It must pass `mutateClients` as a prop to `CreateClientDialog` (see Step 2.5). Do NOT call `useClients()` inside the dialog.

```typescript
// In client-list.tsx:
<CreateClientDialog onCreated={mutateClients} />
```

**Verify:** Manual — page loads, shows seed data clients, search/filter work.

---

## Step 2.5 — Client Creation Form

**Purpose:** Dialog form for creating a new client.

**Create:**
- `src/components/clients/create-client-dialog.tsx` — dialog with form

**Fields:** name (required), industry (required), website (optional), hqLocation (optional), notes (optional)

**Props interface (the dialog does NOT call `useClients()` internally):**

```typescript
interface CreateClientDialogProps {
  onCreated: () => void; // Called after successful creation to invalidate cache
}

export function CreateClientDialog({ onCreated }: CreateClientDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: CreateClientData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // 🔧 FIX3: explicit header
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        // Show toast with err.error or err.details
        // If err.details exists, format field-level errors
        return;
      }
      const created = await res.json();
      setOpen(false);
      onCreated(); // Invalidates all filtered client lists
      router.push(`/clients/${created.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  // ... form JSX with isSubmitting on button disabled state
}
```

**🆕 ADD3 — Client-side validation type:**

Define `CreateClientData` to match the API schema so the form knows what to send:

```typescript
interface CreateClientData {
  name: string;
  industry: string;
  website?: string;
  hqLocation?: string;
  notes?: string;
}
```

You can optionally reuse the Zod schema from the API route by extracting it to a shared file (`src/lib/schemas/client.ts`) and using `z.infer<typeof createClientSchema>`. This avoids type drift. If you do this, move the schema definitions out of the route file.

**Behavior:**
- Triggered from "New Client" button on list page
- Client-side validation matching API schema
- POST to `/api/clients`
- On success: close dialog, call `onCreated()`, toast, navigate to new client
- On error: toast with error message. If `err.details` exists, show field-level errors.
- Loading state on submit button (`isSubmitting`)

**Verify:** Manual — create a client, see it in the list, AI research starts.

---

## Step 2.7 — Contacts CRUD (moved before overview)

**Purpose:** API routes + UI for managing contacts within a client.

**Create (tests first):**
- `src/__tests__/api/contacts.test.ts`

**Create (routes):**
- `src/app/api/clients/[id]/contacts/route.ts` — GET (list by client) + POST (create)
- `src/app/api/contacts/[id]/route.ts` — GET + PATCH + DELETE

**Create (UI):**
- `src/components/clients/contacts-section.tsx` — contact list within client overview
- `src/components/clients/contact-form-dialog.tsx` — create/edit contact dialog

**Route structure:**

| Route | Auth | Query |
|-------|------|-------|
| GET /api/clients/[id]/contacts | `requireUserId()` | `listContactsByClient(id)` |
| POST /api/clients/[id]/contacts | `requireAdmin()` | `createContact({clientId, ...data})` |
| GET /api/contacts/[id] | `requireUserId()` | `getContactById(id)` |
| PATCH /api/contacts/[id] | `requireAdmin()` | `updateContact(id, data)` |
| DELETE /api/contacts/[id] | `requireAdmin()` | `softDeleteContact(id)` |

**Zod schemas for contacts:**

```typescript
const createContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const updateContactSchema = createContactSchema.partial();
```

**Test scenarios for `contacts.test.ts`:**

| Test | Expected | Notes |
|------|----------|-------|
| GET /api/clients/[id]/contacts — unauthenticated | 401 | |
| GET /api/clients/[id]/contacts — returns list | 200 + array | |
| POST /api/clients/[id]/contacts — viewer role | 403 | |
| POST /api/clients/[id]/contacts — invalid body (missing name) | 400 | |
| POST /api/clients/[id]/contacts — valid body | 201 + created contact | |
| POST /api/clients/[id]/contacts — nonexistent client | 404 | 🔧 FIX4: Client check runs BEFORE body parsing — a nonexistent client always returns 404, even if the body is also invalid. Tests must not depend on body validation running first. |
| POST /api/clients/[id]/contacts — malformed JSON | 400 | Only reachable if client exists (client check is first) |
| GET /api/contacts/[id] — not found | 404 | |
| GET /api/contacts/[id] — found | 200 + contact | |
| PATCH /api/contacts/[id] — viewer role | 403 | |
| PATCH /api/contacts/[id] — invalid body | 400 | |
| PATCH /api/contacts/[id] — not found | 404 | |
| PATCH /api/contacts/[id] — success | 200 + updated contact | |
| DELETE /api/contacts/[id] — viewer role | 403 | |
| DELETE /api/contacts/[id] — not found | 404 | |
| DELETE /api/contacts/[id] — success | 200 | |

**🔧 FIX4 — Validation order for POST /api/clients/[id]/contacts (fixes Gap #20):**

The route handler checks conditions in this exact order:
1. `requireAdmin()` → 401/403
2. `getClientById(id)` → 404 if client doesn't exist
3. `parseJSON(request)` → 400 if malformed JSON
4. Zod validation → 400 if fields invalid

This means: if a client doesn't exist, the route returns 404 **regardless** of whether the body is valid, invalid, or malformed. The malformed JSON test and invalid body test should use a **valid client ID** in the mock to ensure they actually test body validation and not the client check.

Example test setup for body validation tests:

```typescript
it('returns 400 for invalid body', async () => {
  // Mock client exists — so the route reaches body parsing
  vi.mocked(getClientById).mockResolvedValue({ id: 'client-1', name: 'Acme' });

  const req = createRequest('POST', 'http://localhost/api/clients/client-1/contacts', {});
  const res = await POST(req, { params: Promise.resolve({ id: 'client-1' }) });
  expect(res.status).toBe(400);
});

it('returns 404 for nonexistent client regardless of body', async () => {
  // Mock client does NOT exist — body is never checked
  vi.mocked(getClientById).mockResolvedValue(null);

  // Even with a valid body, should still 404
  const req = createRequest('POST', 'http://localhost/api/clients/ghost/contacts', {
    name: 'John Doe',
  });
  const res = await POST(req, { params: Promise.resolve({ id: 'ghost' }) });
  expect(res.status).toBe(404);
});
```

**POST contacts — full implementation with correct validation order:**

```typescript
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Step 1: Verify client exists BEFORE touching the body
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Step 2: Parse body (only reached if client exists)
    const { data, error } = await parseJSON(request); // 🔧 FIX3: safe JSON parse
    if (error) return error;

    // Step 3: Validate fields
    const parsed = createContactSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const contact = await createContact({ clientId: id, ...parsed.data });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**🔧 FIX3 — Use same `parseJSON` helper from Step 2.2** in all contact routes that accept a body. Either import from shared util or copy inline.

**🔧 FIX3 — `softDeleteContact` contract:** Same as `softDeleteClient` — verify it returns null on not-found, truthy on success.

```bash
grep -A 10 'softDeleteContact' src/lib/db/queries/contacts.ts
```

**UI — `contacts-section.tsx` props (fixes Gap #17):**

The contacts section lives inside the client overview. It needs both `mutateContacts` (from `useContacts`) AND `mutateClient` (from the parent overview) because after adding/deleting a contact, the parent `getClientWithRelations` data (which includes contacts) is also stale.

```typescript
interface ContactsSectionProps {
  clientId: string;
  mutateClient: () => void; // 🔧 FIX3: passed from client-overview.tsx
}

export function ContactsSection({ clientId, mutateClient }: ContactsSectionProps) {
  const { contacts, isLoading, mutateContacts } = useContacts(clientId);

  const onContactCreated = () => {
    mutateContacts();
    mutateClient(); // Also refresh the parent client data
  };

  const onContactDeleted = () => {
    mutateContacts();
    mutateClient();
  };

  // ... render contacts list + ContactFormDialog with onContactCreated
}
```

**Verify:** `npx vitest run src/__tests__/api/contacts` — all GREEN + manual UI test.

---

## Step 2.6 — Client Overview Page

**Purpose:** Detail page for a single client at `/clients/[clientId]`.

**Create:**
- `src/app/(dashboard)/clients/[clientId]/page.tsx` — server component shell (`await params`)
- `src/components/clients/client-overview.tsx` — main component (uses `useClient(id)`)
- `src/components/clients/client-detail-card.tsx` — inline-editable client fields
- `src/components/clients/ai-summary-card.tsx` — AI research display + "Research more"
- `src/components/clients/processes-section.tsx` — placeholder process list (Phase 3)

**Features:**

1. **Detail card** — name, industry, website, HQ, notes, status. Inline edit (click → input, blur → PATCH). Admin-only editing.
2. **AI summary card** — renders `aiSummary` as markdown. States: loading skeleton, content, no-key message, error + retry. "Research more" button → POST `/api/clients/[id]/research`.
3. **Contacts section** — from step 2.7. Lists contacts, "Add contact" button.
4. **Processes section** — reads from `getClientWithRelations` response. Placeholder links to Phase 3.

**Critical pattern — `await params`:**

```typescript
// src/app/(dashboard)/clients/[clientId]/page.tsx
export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientOverview clientId={clientId} />;
}
```

**Client overview wiring (🔧 FIX3: passes mutateClient to children):**

```typescript
// src/components/clients/client-overview.tsx
'use client';

import { useClient } from '@/lib/hooks/use-clients';
// ... other imports

export function ClientOverview({ clientId }: { clientId: string }) {
  const { client, isLoading, error, mutateClient } = useClient(clientId);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !client) return <NotFound />;

  return (
    <div>
      <ClientDetailCard client={client} clientId={clientId} mutateClient={mutateClient} />
      <AISummaryCard client={client} clientId={clientId} mutateClient={mutateClient} />
      <ContactsSection clientId={clientId} mutateClient={mutateClient} /> {/* 🔧 FIX3 */}
      <ProcessesSection processes={client.processes ?? []} />
    </div>
  );
}
```

**Inline edit pattern for `client-detail-card.tsx`:**

```typescript
interface ClientDetailCardProps {
  client: Client;
  clientId: string;
  mutateClient: () => void;
}

export function ClientDetailCard({ client, clientId, mutateClient }: ClientDetailCardProps) {
  const onFieldBlur = async (field: string, value: string, originalValue: string) => {
    if (value === originalValue) return; // Don't PATCH if unchanged
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, // 🔧 FIX3: explicit header
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      // Show toast with error, revert field to originalValue
      return;
    }
    mutateClient(); // Revalidate client data
  };
  // ... render with inline edit inputs
}
```

**AI summary "Research more" button:**

```typescript
interface AISummaryCardProps {
  client: Client;
  clientId: string;
  mutateClient: () => void;
}

export function AISummaryCard({ client, clientId, mutateClient }: AISummaryCardProps) {
  const [researching, setResearching] = useState(false);

  const onResearchMore = async () => {
    setResearching(true);
    await fetch(`/api/clients/${clientId}/research`, { method: 'POST' });
    // Poll or use a timeout since research is fire-and-forget
    // Simple approach: wait 5s then revalidate
    setTimeout(() => {
      mutateClient();
      setResearching(false);
    }, 5000);
  };

  // Render states: loading, content, no-key message, error + retry
  // If client.aiSummary is null and not researching → show "No research yet"
  // If client.aiSummary contains "set key in Settings" → show no-key message
  // Otherwise → render markdown
}
```

**⚠️ Note:** The polling approach is imperfect. For Phase 2 this is acceptable. Phase 3+ could use server-sent events or websockets for real-time updates.

**Verify:** Manual — navigate from list, see detail, edit fields, see AI summary, manage contacts.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `maxTokens` renamed to `maxOutputTokens` in AI SDK v6 | Research function fails | Check `ai@6.0.116` API — use correct parameter name |
| `webSearch_20250305()` not available in `@ai-sdk/anthropic@3.0.58` | No web search in research | Fall back to plain `generateText` without tools |
| Zod v4 `.error.flatten()` shape differs from v3 | 400 responses have wrong format | Test validation errors in step 2.1, enforce shape |
| Forgetting `await params` in dynamic routes | Runtime crash | Enforce in every `[id]`/`[clientId]` route |
| SWR cache stale after mutations | UI shows outdated data | Use `useSWRConfig().mutate` with key matcher after every POST/PATCH/DELETE |
| `insertClientSchema` allows `id`, `createdAt` | Users can set IDs | Use custom `createClientSchema` with only user-facing fields |
| Fire-and-forget research might silently fail | `aiSummary` stays null | Function catches all errors and always writes something to `aiSummary` |
| POST contact to nonexistent client | Orphaned contact / FK error | Verify client exists before creating contact |
| `getClientById` may not exist in query layer | Research route and contact POST fail | Verify export exists; add if missing |
| No SWRConfig provider | Refetch-on-focus flicker during inline edit | Add provider in dashboard layout (Step 2.8) |
| `useClient` missing `mutate` export | Overview page inline edit has no way to revalidate | Return `mutateClient: result.mutate` from hook |
| Dialog calls `useClients()` redundantly | Double subscription, wasted request | Pass `onCreated` callback as prop instead |
| `softDeleteClient`/`softDeleteContact` may throw on not-found | Route crashes with 500 instead of 404 | Verify query functions return null on not-found |
| `triggerCompanyResearch` import fails during Step 2.2 build | `npm run build` fails | Create stub file in Step 2.1 |
| Malformed JSON body crashes route | 500 instead of 400 | Wrap `request.json()` in safe parser |
| Contacts section doesn't refresh parent | Overview shows stale contact count | Pass `mutateClient` prop to `ContactsSection` |
| 🆕 `globalMutate` from `swr` doesn't accept function matchers | `mutateClients()` silently fails — list never refreshes after create/delete | Use `useSWRConfig().mutate` which supports function matchers in SWR v2 |
| 🆕 Contact POST validation order ambiguity | Junior reorders checks, nonexistent client returns 400 instead of 404 | Documented: client check runs first, body parsing second. Tests mock accordingly. |
| 🆕 Over-revalidation from key matcher | `mutateClients` also refreshes contacts/detail caches | Documented as intentional; warning comment not to narrow the matcher |
| 🆕 Research test only asserts AI call, not persistence | `updateClient` never called — `aiSummary` stays null in production | Explicit test assertion: `expect(updateClient).toHaveBeenCalledWith(clientId, { aiSummary: ... })` |

---

## File Summary

**New files (28):**

| File | Step |
|------|------|
| `src/__tests__/api/clients.test.ts` | 2.1 |
| `src/__tests__/api/clients-id.test.ts` | 2.1 |
| `src/lib/ai/prompts/company-research.ts` (stub) | 2.1 |
| `src/app/api/clients/route.ts` | 2.2 |
| `src/app/api/clients/[id]/route.ts` | 2.2 |
| `src/lib/api/utils.ts` (parseJSON helper) | 2.2 |
| `src/__tests__/ai/company-research.test.ts` | 2.3 |
| `src/__tests__/api/clients-id-research.test.ts` | 2.3 |
| `src/app/api/clients/[id]/research/route.ts` | 2.3 |
| `src/components/providers/swr-provider.tsx` | 2.8 |
| `src/lib/hooks/use-clients.ts` | 2.8 |
| `src/lib/hooks/use-contacts.ts` | 2.8 |
| `src/components/clients/client-list.tsx` | 2.4 |
| `src/components/clients/client-card.tsx` | 2.4 |
| `src/components/clients/client-filters.tsx` | 2.4 |
| `src/components/clients/status-badge.tsx` | 2.4 |
| `src/components/clients/create-client-dialog.tsx` | 2.5 |
| `src/__tests__/api/contacts.test.ts` | 2.7 |
| `src/app/api/clients/[id]/contacts/route.ts` | 2.7 |
| `src/app/api/contacts/[id]/route.ts` | 2.7 |
| `src/components/clients/contacts-section.tsx` | 2.7 |
| `src/components/clients/contact-form-dialog.tsx` | 2.7 |
| `src/app/(dashboard)/clients/[clientId]/page.tsx` | 2.6 |
| `src/components/clients/client-overview.tsx` | 2.6 |
| `src/components/clients/client-detail-card.tsx` | 2.6 |
| `src/components/clients/ai-summary-card.tsx` | 2.6 |
| `src/components/clients/processes-section.tsx` | 2.6 |

**Modified files (4):**
- `src/app/(dashboard)/clients/page.tsx` — replace placeholder (step 2.4)
- `src/app/(dashboard)/layout.tsx` — add `<SWRProvider>` wrapper (step 2.8)
- `src/lib/ai/prompts/company-research.ts` — replace stub with real implementation (step 2.3)
- `SPEC.md` — update after each completed step

**Possibly modified (verify first):**
- `src/lib/db/queries/clients.ts` — may need `getClientById` if only `getClientWithRelations` exists
- `src/lib/db/queries/clients.ts` — verify `softDeleteClient` returns null on not-found
- `src/lib/db/queries/contacts.ts` — verify `softDeleteContact` returns null on not-found

---

## Verification Checklist (Phase 2 Gate)

- [ ] `npx vitest run` — all tests pass (clients + contacts + research API)
- [ ] `npm run build` — clean build, no TypeScript errors
- [ ] Client list page shows seed data clients
- [ ] Create client → appears in list → AI research populates `aiSummary`
- [ ] "Research more" button triggers new research
- [ ] No API key → research shows "set key in Settings" (no crash)
- [ ] Edit client fields inline on overview page
- [ ] Contacts CRUD works within client overview
- [ ] Viewer role cannot create/edit/delete (403)
- [ ] All API routes return proper error codes (400, 401, 403, 404, 500)
- [ ] Malformed JSON body returns 400, not 500
- [ ] Creating a contact on a nonexistent client returns 404
- [ ] SWR cache updates correctly after create/edit/delete (no stale data with active filters)
- [ ] Tab switching does not cause refetch flicker during inline editing
- [ ] `useClient(id).mutateClient()` works from overview page after PATCH
- [ ] Contact create/delete refreshes both contact list AND parent client data
- [ ] DELETE routes return `{ message: '...' }` with 200 (not empty body)
- [ ] 🆕 Research unit tests assert both `generateText` call AND `updateClient` persistence
- [ ] 🆕 Contact POST to nonexistent client returns 404 even with valid body