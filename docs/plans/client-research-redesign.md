# Plan: Replace `clients.aiSummary` + `clients.profile` with a dedicated `client_research` table and a two-step AI research gateway

## Context

This plan captures the work sitting in the `feature/improve_client_data_model`
branch as uncommitted changes. Dev has since moved on (Traza rebase + other
refactors), so we want to **rebuild this work as a fresh branch on the new
`develop` tip** rather than merge/rebase the old tree and risk stepping on
decisions the full-stack colleague has made.

Nothing here touches code outside the scope listed below. Use this as the
shopping list when redoing the work.

## Goals

1. Retire the two legacy client-research shapes:
   - `clients.ai_summary` — free-form prose summary (text).
   - `clients.profile` — JSONB `CompanyProfile` added during Bloque 1 of the
     AI redesign.
2. Replace them with a single **`client_research`** table (1:1 with
   `clients`) that holds structured AI research output — overview, size,
   customers, pain points, fit score, stakeholders, tech stack, sources.
3. Rewrite the AI feature behind this as a **two-step pipeline** on the
   local gateway: web-search discovery (prose + citations) → structured
   extraction (typed payload).
4. Collapse the two client-overview cards (`AISummaryCard` +
   `CompanyProfileCard`) into a single `ClientResearchCard`.

Out of scope: Traza-side implementation of `researchClient` (stub stays as
`NotImplementedError`), anything outside the client-research surface.

---

## 1. Database

### New migration: create `client_research`

```sql
CREATE TABLE client_research (
  client_id uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  company_overview       text,
  size_financials        text,
  customers_markets      text,
  pain_points            text,
  recent_news            text,
  fit_score              integer,
  fit_score_rationale    text,
  areas_of_expertise     jsonb NOT NULL DEFAULT '[]'::jsonb,
  products_and_services  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- {name, description}[]
  key_stakeholders       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- {name, role, linkedinUrl?}[]
  tech_stack             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  research_sources       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- {title, url, retrievedAt?}[]
  researched_at          timestamptz,
  schema_version         integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fit_score_range CHECK (fit_score BETWEEN 1 AND 10)
);
```

### Second migration: drop legacy columns

```sql
ALTER TABLE clients DROP COLUMN ai_summary;
ALTER TABLE clients DROP COLUMN profile;
```

Keep these as two separate migrations so the create lands first and the
drops are an isolated, reversible step.

### `src/lib/db/schema.ts`

- Add `clientResearch` pgTable matching the migration above. Type the JSONB
  columns via the new contract types: `string[]`, `ProductOrService[]`,
  `KeyStakeholder[]`, `ResearchSource[]`.
- Add the `CHECK` via Drizzle's `check('fit_score_range', sql\`... BETWEEN 1 AND 10\`)`.
- Remove `aiSummary` and `profile` fields from the `clients` table.
- Add `clientResearchRelations` and extend `clientsRelations` with
  `research: one(clientResearch)`.
- Export `insertClientResearchSchema`, `selectClientResearchSchema`,
  `ClientResearch`, `NewClientResearch`.

### `src/lib/db/queries/client-research.ts` (new)

Three functions, in line with the single-responsibility query rule:

- `getResearchByClientId(clientId) → ClientResearch | null`
- `upsertClientResearch(clientId, payload) → ClientResearch` using
  `onConflictDoUpdate` on `clientId`; normalise a string `researchedAt`
  into `Date`; always bump `updatedAt` on update.
- `deleteResearchByClientId(clientId) → void` (ON DELETE CASCADE also
  covers this; keep the helper for explicit deletes).

Re-export from `src/lib/db/queries/index.ts`.

### `src/lib/db/seed.ts`

Remove the inline `aiSummary` on the first seeded client and insert one
`client_research` row for it instead (company overview prose, fit 8,
rationale, areas/tech-stack, empty sources).

---

## 2. AI contracts

### Delete `src/lib/ai/contracts/company-profile.ts`

### New `src/lib/ai/contracts/client-research.ts`

Three schemas — the split matters because Anthropic's structured outputs
reject `minimum`/`maximum`/integer constraints on JSON Schema numbers, so
we can't put the `fitScore` bound or the server-stamped fields in the
schema we hand to `generateObject`.

- `generatedClientResearchSchema` — optional strings + defaulted arrays;
  `fitScore: z.number().optional()`; transforms to strip any
  `schemaVersion`/`researchedAt`/`researchSources` the model might
  accidentally produce.
- `clientResearchSchema` — the persisted contract, extends the generated
  object with:
  - `fitScore: z.number().int().min(1).max(10).optional()` (server-side
    validation, mirrored by the DB `CHECK`).
  - `schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION)`.
  - `researchSources: z.array(researchSourceSchema).default([])`.
  - `researchedAt: z.string().datetime()`.
- Helpers: `researchSourceSchema { title, url, retrievedAt? }`,
  `productOrServiceSchema { name, description }`,
  `keyStakeholderSchema { name, role, linkedinUrl? }`.
- Export the inferred types: `GeneratedClientResearch`,
  `ClientResearchPayload`, `ResearchSource`, `ProductOrService`,
  `KeyStakeholder`.

### `src/lib/ai/contracts/index.ts`

Replace `export * from './company-profile'` with
`export * from './client-research'`.

### `src/lib/ai/contracts/worker-input.ts`

- Replace `'refresh-company-profile'` with `'client-research'` in
  `FeatureSlug`.
- `ClientContext.profile: CompanyProfile | null` →
  `research: ClientResearchPayload | null`.
- Rename `RefreshCompanyProfileInput` → `ClientResearchInput`; its feature
  slug literal changes to `'client-research'`; `params` stays
  `{ clientId: string }`.
- Update the `WorkerInput` union member.

### `src/lib/ai/contracts/__fixtures__/index.ts`

Replace `validCompanyProfile` with `validGeneratedClientResearch` +
`validClientResearch` (spread the first into the second, add
`schemaVersion: 1`, one research source, `researchedAt`).

---

## 3. AI features, templates, prompts

### Delete

- `src/lib/ai/features/company-research.ts`
- `src/lib/ai/features/refresh-company-profile.ts`
- `src/lib/ai/templates/refresh-company-profile.ts`
- `src/lib/ai/prompts/company-research.ts`
- `src/lib/ai/trigger-research.ts` (old fire-and-forget trigger)
- The `company-research` entry in `src/lib/ai/prompts/fixtures.ts`.

### New `src/lib/ai/features/client-research.ts`

Single `FeatureConfig`:

- `slug: 'client-research'`, `mode: 'generateObject'`, `model: 'standard'`.
- Two system prompts exported from this file:
  - `CLIENT_RESEARCH_DISCOVERY_PROMPT` — "senior business research
    analyst", cite every claim with source URL inline, cover overview /
    size / customers / pain points / recent news / expertise / products /
    stakeholders / tech stack, say when uncertain.
  - `CLIENT_RESEARCH_EXTRACTION_SYSTEM_PROMPT` (assigned to
    `feature.systemPrompt`) — "convert free-form company research into a
    strict structured payload", spell out each field, emphasise
    `fitScore` is 1-10 higher = stronger fit for discovery-led
    process-modernisation engagement, no inventing stakeholders/news.
- `tools: [{ tool: 'web-search', options: { maxSteps: 4 } }]`,
  `maxOutputTokens: 4000`, `resilience: { layerTimeout: 5000,
  totalTimeout: 90000, fallbackOnLayerError: false }`, `enabled: true`.

### New `src/lib/ai/templates/client-research.ts`

Two renderers built on `renderTemplate`:

- `renderClientResearchDiscoveryTemplate({ name, industry, website })` —
  a "Company" block.
- `renderClientResearchExtractionTemplate({ name, industry, website,
  researchProse, sources })` — "Company" + "Research material" +
  "Discovered sources" sections.

### `src/lib/ai/features/registry.ts`

Drop `company-research` and `refresh-company-profile` entries, add
`'client-research': clientResearchFeature`.

---

## 4. AI gateway

### `src/lib/ai/gateway.ts` (interface)

- Rename `RefreshCompanyProfileGatewayInput` → `ResearchClientGatewayInput`.
  Keep `{ clientName, clientIndustry, clientWebsite }` and **add**
  `anthropic: { tools: { webSearch_20250305: () => unknown } }` — the
  local gateway needs the Anthropic tool factory.
- Rename the method on `AIGateway`:
  `refreshCompanyProfile(input): Promise<CompanyProfile>` →
  `researchClient(input): Promise<ClientResearchPayload>`.

### `src/lib/ai/gateway-local.ts`

- Implement `researchClient` as a **two-step flow**:
  1. `generateText` with the discovery prompt, system =
     `CLIENT_RESEARCH_DISCOVERY_PROMPT`, tools =
     `{ web_search: anthropic.tools.webSearch_20250305() }`,
     `stopWhen: stepCountIs(2)`, `maxOutputTokens: feature.maxOutputTokens`.
  2. Extract sources from `discovery.steps[].content[]` parts of
     `type: 'tool-result'`, reading `output` as
     `Array<{ url, title, ... }>`. Dedupe by URL, stamp each with
     `retrievedAt = new Date().toISOString()` (taken once before the
     extraction call).
  3. Cap prose fed into step 2 at **8000 chars** to stay under Anthropic's
     per-minute input-token limits.
  4. `generateObject` with the extraction prompt, system =
     `feature.systemPrompt`, `schema: generatedClientResearchSchema`,
     `maxOutputTokens: feature.maxOutputTokens`.
  5. Return `clientResearchSchema.parse({ ...object, schemaVersion: 1,
     researchSources: sources, researchedAt })`.
- Factor the step-parsing into `extractWebSearchSources(steps,
  retrievedAt): ResearchSource[]` inside this file.
- Drop the old `generatedProfileSchema` (it was a private z.object
  mirroring the old CompanyProfile).

### `src/lib/ai/gateway-traza.ts`

Rename the stub to `researchClient`, keep
`throw new NotImplementedError('researchClient')`. Update the imported
type to `ClientResearchPayload`.

### Factory + feature routing

No changes needed — the factory dispatches by feature slug; since the
slug is now `'client-research'`, the existing routing hands it to the
local gateway until the Traza side implements it.

---

## 5. API routes

### `POST /api/clients/[id]/research` (rewrite)

- `requireAdmin()`.
- 404 if client missing.
- `getAIConfig('research')` — returns `{ model, anthropic }`.
- `getAIGateway('client-research').researchClient({ clientName,
  clientIndustry, clientWebsite, model, anthropic })`.
- `upsertClientResearch(id, payload)`.
- `NextResponse.json(persisted)` — **return the row**, not
  `{ message: 'Research started' }`. This is a *sync* call now, not a
  fire-and-forget.
- Keep `handleAPIError` — it already maps `NO_API_KEY → 422`.

### `GET /api/clients/[id]/research` (new)

- `requireUserId()` (reads are for any authed user).
- `getResearchByClientId(id)` — returns the row or `null`.
- `NextResponse.json(research)`.

### `POST /api/clients/route.ts`

Remove the fire-and-forget `triggerCompanyResearchViaBuilder` block. The
front-end will call the new research endpoint explicitly via the
"Research" button on `ClientResearchCard`.

### Delete `src/app/api/clients/[id]/refresh-profile/route.ts`

Its job moved into the rewritten `/research` handler.

---

## 6. AI context & layers

### `src/lib/ai/context.ts` (`buildSessionContext`)

- Change `SessionContext.client.aiSummary: string | null` to
  `companyOverview: string | null`.
- Add `getResearchByClientId(client.id)` to the existing
  `Promise.all([...])`.
- Populate `companyOverview: research?.companyOverview ?? null`.

### `src/lib/ai/layers/l2-client.ts`

- When `fields === 'full'`, fetch `research = await
  getResearchByClientId(clientId)` and format it into a rich `### AI
  Research` block that includes:
  - `companyOverview` as the lead paragraph.
  - `Fit: N/10 — rationale` bullet when `fitScore` is set.
  - Bullets for `sizeFinancials`, `customersMarkets`, `painPoints`,
    `recentNews`, `areasOfExpertise`, `productsAndServices`,
    `keyStakeholders`, `techStack` — each gated on non-empty value.
- Drop `client.aiSummary ? '### AI Summary\n…' : null` and the old
  `formatCompanyProfile(client.profile)` helper.
- Drop the `clientAiSummary` and `clientProfileSection` entries from the
  returned `templateVars`.
- Return `{ data: { client, research }, templateVars }` (include
  `research` so callers can read the structured shape without re-fetching).

### `src/lib/ai/prompts/prep-brief.ts` and
`src/lib/ai/prompts/session-interview.ts`

Swap `client.aiSummary` → `client.companyOverview` in both prompt
builders (the call sites are one-liners each).

---

## 7. Client-side modules (`src/modules/clients/`)

### Delete

- `components/ai-summary-card.tsx`
- `components/company-profile-card.tsx`
- `hooks/use-company-profile.ts`

### New `components/client-research-card.tsx`

Single collapsible card, driven by `useClientResearch(clientId)`:

- Title `"AI Research"` plus a relative-time suffix (`"· last run 12m
  ago"`) when `researchedAt` exists.
- Actions: `<Button>Research / Re-research / Researching…</Button>`
  that calls `generate()`; spinner when `isResearching`.
- States:
  - `isLoading` → `<ResearchSkeleton />`.
  - `isResearching && !hasResearch` → "Researching… this can take ~1
    minute." + skeleton.
  - `!hasResearch` → "No research yet. Click 'Research' to start."
  - else `<ResearchBody />`.
- `<ResearchBody>` renders, each gated on truthy value:
  `<FitScoreBadge>`, Overview, Size & financials, Customers & markets,
  Pain points, Recent news, Areas of expertise (badges), Products &
  services (list), Key stakeholders (list), Tech stack (badges),
  Sources (external links with `ExternalLink` icon).
- `<FitScoreBadge>` picks badge variant: `>=8 → default`,
  `>=5 → secondary`, else `outline`.

### New `hooks/use-client-research.ts`

SWR hook keyed on `CLIENT_KEYS.research(clientId)` that fetches via
`clientResearchService.get`. Exposes:
`research`, `isLoading`, `mutateResearch`, plus a `generate()` that:
- calls `clientResearchService.generate(clientId)`,
- `mutate(payload, false)` to update cache without revalidation,
- `toast.success('Research updated')` / `toast.error('Research failed',
  { description })` on failure,
- manages its own `isResearching` boolean (don't fold into SWR's
  mutation state — the card needs an "in-flight" signal separate from
  the fetch).

### New `services/client-research-service.ts`

Class-based singleton with `get(clientId)` and
`generate(clientId)` methods on base path `/api/clients`.

### `components/client-overview.tsx`

Replace

```tsx
<CompanyProfileCard clientId={clientId} profile={client.profile ?? null} />
<AISummaryCard client={client} clientId={clientId} mutateClient={mutateClient} />
```

with

```tsx
<ClientResearchCard clientId={clientId} />
```

### `lib/swr-keys.ts`

Add `research: (id: string) => \`${BASE}/${id}/research\`` to
`CLIENT_KEYS`.

### `services/clients-service.ts`

Delete `generateResearch` and `refreshProfile` — the new dedicated
service owns both.

### `types/index.ts`

- Add `ClientResearch` to the `@/lib/db/schema` re-export.
- Re-export `ClientResearchPayload` from `@/lib/ai/contracts` (drop
  `CompanyProfile`).
- Remove `aiSummary?: string` from `ClientUpdateInput`.

---

## 8. Tests

### Delete

- `src/__tests__/ai/company-research.test.ts`
- `src/__tests__/api/clients-id-refresh-profile.test.ts`
- `src/__tests__/db/clients-profile-schema.test.ts`

### Rewrite `src/__tests__/api/clients-id-research.test.ts`

- Mock `@/lib/db/queries/client-research` (`upsertClientResearch`).
- Mock `@/lib/ai/gateway-factory` to return `{ researchClient:
  mockResearchClient }`; `mockResearchClient.mockResolvedValue(
  validClientResearch)`.
- Keep 401 / 403 / 404 coverage.
- Add 422 case when `getAIConfig` rejects with `new Error('NO_API_KEY')`.
- Happy path: `POST` returns the persisted row with `clientId` +
  `fitScore`, asserts `researchClient` was called with
  `{ clientName, clientIndustry, clientWebsite, model }`, asserts
  `upsertClientResearch(clientId, {...})` received the payload's
  structured fields.
- Smoke test: `GET` handler is exported and is a function.

### New tests

- `src/__tests__/ai/contracts/client-research.test.ts` — schema parse,
  `fitScore` bound, transform strips server-only fields.
- `src/__tests__/ai/gateway-local-research-client.test.ts` — mocks
  `generateText` + `generateObject`, asserts source extraction/dedup,
  8000-char prose cap, final `clientResearchSchema.parse`.
- `src/__tests__/db/client-research-schema.test.ts` — Drizzle insert
  round-trip, `fit_score` check constraint rejects 0/11.
- `src/__tests__/db/queries/client-research.test.ts` — upsert
  insert-path and update-path, `getResearchByClientId` null on missing.
- `src/__tests__/modules/clients/client-research-service.test.ts` —
  service hits the right URLs via `apiClient`.

### Adjust existing

- `unit/ai/layers/l2-client.test.ts` — assert the new
  `### AI Research` formatting, `fitScore` bullet, fall-through when
  no research row.
- `unit/ai/build-session-context.test.ts` — rename `aiSummary` →
  `companyOverview`, stub `getResearchByClientId`.
- `unit/ai/prompts/behavioral.test.ts` — adapt to `companyOverview`.
- `ai/features-registry.test.ts` — expect `'client-research'`, no
  `'company-research'`/`'refresh-company-profile'`.
- `ai/contracts.test.ts` — drop `CompanyProfile` assertions, add
  `ClientResearchPayload`.
- `ai/worker-input.test.ts` — rename slug.
- `ai/gateway-parity.test.ts` + `ai/gateway-traza.test.ts` — method
  rename.
- `unit/db/schema.test.ts` — drop `aiSummary`/`profile` assertions.
- `modules/clients/clients-service.test.ts` — drop tests for the
  removed `generateResearch`/`refreshProfile` methods.

---

## Execution order (suggested)

1. **DB first** — schema change, two migrations, queries, seed update.
2. **Contracts** — delete `company-profile`, add `client-research`,
   update `worker-input` + fixtures.
3. **Gateway** — interface rename, local implementation (two-step with
   web search), Traza stub rename.
4. **Feature + templates + registry** — delete old, add new.
5. **API routes** — rewrite POST, add GET, delete refresh-profile
   route, strip auto-trigger from create client.
6. **Context & layers & prompts** — `context.ts`, `l2-client.ts`,
   `prep-brief.ts`, `session-interview.ts`.
7. **Client modules** — service, hook, card, swap in `client-overview`,
   swr-keys, types, remove legacy.
8. **Tests** — delete stale, rewrite research API test, add new tests,
   touch every test that referenced `aiSummary` / `profile`.
9. `npm run db:push`, `npm run format`, full Vitest run.

## Why redo rather than merge

- All branch work lives as *uncommitted* edits on top of the old
  `develop`; there's nothing to cherry-pick cleanly.
- Dev has changed substantially (Traza rebase, AI gateway redesign,
  processes/graph changes); merge conflicts would touch files whose
  decisions we haven't owned.
- The change set is medium-sized and self-contained (one table, one
  gateway method, one UI card, local test churn). Re-implementing on a
  fresh branch against the new tip is faster and safer than resolving
  conflicts blind.
