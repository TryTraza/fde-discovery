# FDE Discovery Tool — SPEC.md

> **This file is updated after every completed step.**
> Claude Code reads this at the start of every session to understand current state.
> Alberto owns the content. Claude Code owns the updates (with approval).

---

## Current State

```
Phase:          5 — Shadowing Capture (IN PROGRESS)
Last Completed: Step 5.8 — Post-capture screen (transcript + notes before debrief)
Next Step:      Step 5.9 — iPad test (all buttons 64px+)
Blocker:        None
```

---

## Phase Completion Tracker

### Phase 0 — Setup & Infrastructure
- [x] 0.1 — Scaffold Next.js project + install dependencies
- [x] 0.2 — Project directory structure created
- [x] 0.3 — `.env.local` configured (Clerk + Supabase + no Anthropic key)
- [x] 0.4 — Drizzle config + DB client
- [x] 0.5 — Clerk auth setup (root layout, middleware, sign-in/sign-up pages)
- [x] 0.6 — Vitest configuration
- [x] 0.7 — Dashboard layout shell (sidebar + breadcrumb placeholder)
- [x] 0.8 — Settings page (API key input + model selection + test key button)
- [x] 0.9 — Verify: app runs locally, Clerk login works, Vercel deploy (pending)

### Phase 1 — Database Schema & ORM
- [x] 1.1 — Write schema tests (RED) — 21 tests, all RED then GREEN
- [x] 1.2 — Define full schema (`schema.ts`) — 11 tables, 9 enums, relations, Zod schemas, TS types
- [x] 1.3 — JSONB type definitions (`types.ts`) — ProcessStep, EdgeCase, SystemEntry, session configs
- [x] 1.4 — Generate & apply migration to Supabase — drizzle-kit generate + push verified
- [x] 1.5 — Query layer (all entities) — 8 query files with v4 fixes (#22, #27)
- [x] 1.6 — Seed script — 2 clients, 3 contacts, 1 process with model, 3 open questions

### Phase 2 — Client CRUD + Company Research
- [x] 2.1 — Write API tests (RED) — 20 client tests + stub
- [x] 2.2 — Client API routes (GET list, POST create, GET by ID, PATCH, DELETE) — 20 tests GREEN
- [x] 2.3 — Company research AI (uses user's key, NO_API_KEY handled) — 8 tests (3 AI + 5 research route)
- [x] 2.8 — SWR hooks (moved before UI) — SWRProvider, useClients, useContacts
- [x] 2.4 — Client list page — search, status filter, cards, skeleton/empty states
- [x] 2.5 — Client creation form — dialog with validation, toast, navigate on success
- [x] 2.7 — Contacts CRUD (moved before overview) — 16 tests, routes + UI
- [x] 2.6 — Client overview — inline edit, AI summary, contacts, processes placeholder

### Phase 3 — Process CRUD + Hypothesis
- [x] 3.1 — L1 domain JSON files (procurement + unknown minimum)
- [x] 3.2 — Hypothesis AI (user's key + model)
- [x] 3.3 — Process API routes
- [x] 3.4 — Process creation form
- [x] 3.5 — Process overview + ProcessModel flow component
- [x] 3.6 — System badges with detailNotes tooltip

### Phase 4 — Session Lifecycle (Non-Shadowing)
- [x] 4.0 — Schema audit: added title, durationMinutes, createdBy columns; synthesis_done status; query functions
- [x] 4.1 — Session CRUD API routes (GET list, POST create, GET detail, PATCH, DELETE) + validation schemas
- [x] 4.2 — SWR hooks (useSessions, useSession) + sessions list in process view
- [x] 4.3 — Session creation dialog (3-step: type selector → details → interview → submit)
- [x] 4.4 — AI interview route (3 adaptive questions via generateObject)
- [x] 4.5 — Session detail page (transcript + notes with 2s debounced auto-save, mark completed)
- [x] 4.6 — Prep brief generation (AI route + collapsible card)
- [x] 4.7 — Non-shadowing synthesis (AI route, status=completed required, transcript+notes→synthesis)
- [x] 4.8 — Synthesis display + apply (4 collapsible panels, section toggles, transaction-based apply with snapshot)

### Phase 5 — Shadowing Capture
- [x] 5.1 — Capture page (full-screen, 65/35 split)
- [x] 5.2 — Capture buttons component (5 buttons)
- [x] 5.3 — Input panel with suggestion chips (Haiku model)
- [x] 5.4 — SYSTEM picker with detail notes field
- [x] 5.5 — Event log panel (auto-scroll, color coded)
- [x] 5.6 — Suggestions AI route (NO_API_KEY → empty suggestions, never crash)
- [x] 5.7 — Offline queue + sync
- [x] 5.8 — Post-capture screen (transcript + notes before debrief)
- [ ] 5.9 — iPad test (all buttons 64px+)

### Phase 6 — Debrief + Synthesis
- [ ] 6.1 — Debrief page (sequential card flow)
- [ ] 6.2 — Debrief API route
- [ ] 6.3 — Shadowing synthesis (aggregates system detail notes)
- [ ] 6.4 — Apply changes with snapshots
- [ ] 6.5 — Synthesis display (4 panels: steps diff, edge cases, systems, questions)

### Phase 7 — Research Panel + Polish
- [ ] 7.1 — AI Research panel (streaming, web search, user's key)
- [ ] 7.2 — Follow-up email draft
- [ ] 7.3 — Artifact upload (Supabase Storage)
- [ ] 7.4 — Viewer role enforcement (frontend + backend)
- [ ] 7.5 — Breadcrumb navigation (resolves UUIDs to names)
- [ ] 7.6 — Polish (skeletons, error boundaries, toasts, mobile, auto-save)

---

## Known Decisions & Constraints

| Decision | Detail | Date |
|----------|--------|------|
| No server Anthropic key | Each user stores own key in Clerk privateMetadata | 2026-03-08 |
| Per-feature model selection | 5 features, defaults in get-ai-config.ts | 2026-03-08 |
| Supabase new API format | No anon key; publishable key for client, secret key for server storage | 2026-03-08 |
| Session has transcript + notes | Two separate fields, both feed synthesis | 2026-03-08 |
| SystemEntry.detailNotes | Free-text for column/sheet/mapping capture, aggregated in synthesis | 2026-03-08 |
| prepare: false | Required for Supabase connection pooler (Transaction mode) | 2026-03-08 |
| await params | Next.js 15 — params is a Promise in dynamic routes | 2026-03-08 |
| Suggestions fail silently | NO_API_KEY during capture returns empty suggestions, never crashes UI | 2026-03-08 |
| AI SDK v6 stopWhen | `maxSteps` removed; use `stopWhen: stepCountIs(n)` for tool loops | 2026-03-11 |
| SWR v2 mutate | `globalMutate` from `swr` only accepts string keys; use `useSWRConfig().mutate` for function matchers | 2026-03-11 |
| shadcn v4 no asChild | Button has no `asChild`/`render` prop; use `buttonVariants()` with Link directly | 2026-03-11 |
| parseJSON shared util | `request.json()` throws on malformed input; all POST/PATCH routes use `parseJSON` from `lib/api/utils.ts` | 2026-03-11 |
| Contact POST validation order | Client existence checked before body parsing — nonexistent client always returns 404 regardless of body | 2026-03-11 |
| Fire-and-forget write order | `triggerProcessHypothesis` writes steps BEFORE hypothesisText — UI polls for hypothesisText, so steps must be in DB first | 2026-03-11 |
| processModels lacks deletedAt | Soft-delete cascade from process to processModel skipped; TODO add column in future migration | 2026-03-11 |
| requireAuthWithUser for API key check | Hypothesis route uses `requireAuthWithUser()` + manual role check instead of `requireAdmin()` to access `user.privateMetadata` | 2026-03-11 |
| Fire-and-forget needs pre-resolved model | `getAIConfig` uses `auth()` which requires request context; fire-and-forget runs after response, so model must be resolved eagerly in the route handler and passed as parameter | 2026-03-11 |
| processStepSchema accepts string systems | Seed data stores `systems: ["Email"]` (strings), hypothesis generates `systems: [{name,confirmed,detailNotes}]` (objects); `parseProcessSteps` now handles both via `z.union` | 2026-03-11 |
| Clerk testing + proxy.ts incompatible | `@clerk/testing@2.0.1` `clerk.signIn()` doesn't work with Next.js 16 `proxy.ts`; Playwright E2E auth needs manual approach or future Clerk fix | 2026-03-11 |
| Session type enum uses existing values | `discovery`, `process_mapping`, `shadowing`, `validation`, `demo` (not plan's stakeholder_interview etc.) | 2026-03-16 |
| Session status includes synthesis_done | Added `synthesis_done` to sessionStatusEnum for post-synthesis state | 2026-03-16 |
| Apply-synthesis uses db.transaction | Snapshot + merge + model update + open questions all in one transaction for atomicity | 2026-03-16 |
| Merge functions are pure | `mergeSteps`, `mergeEdgeCases`, `mergeSystems` in `lib/utils/merge-process-model.ts` — no DB access, fully testable | 2026-03-16 |
| Question priority enum | `critical`, `important`, `nice_to_have` (not plan's must_answer/parked) — matches existing schema | 2026-03-16 |
| EVENT_TYPES_MUTABLE for Zod | Drizzle enumValues is readonly; Zod z.enum() requires mutable tuple — use `[...EVENT_TYPES] as [string, ...]` cast | 2026-03-21 |
| eventLogs no deletedAt | Events are immutable — no soft delete column, no soft delete filter needed in queries | 2026-03-21 |
| Suggestions never 500 | `/api/ai/suggestions` catches ALL errors and returns `{ suggestions: [] }` — capture UI must never break | 2026-03-21 |
| (capture) route group | Capture page uses separate `(capture)` route group to avoid dashboard sidebar — hard navigation on post-capture | 2026-03-21 |
| AI SDK v6 maxOutputTokens | `generateObject` uses `maxOutputTokens` not `maxTokens` (v6 breaking change) | 2026-03-21 |
| System picker uses Dialog | shadcn v4 Popover has no `asChild` on PopoverTrigger — replaced with Dialog for system picker | 2026-03-21 |
| No middleware.ts | Auth enforced via `requireUserId`/`requireAdmin` in route handlers, not Clerk middleware | 2026-03-21 |

---

## Discovered Issues / Tech Debt

*(Add issues here as they're discovered during implementation)*

| Issue | Phase Found | Status |
|-------|-------------|--------|
| Zod v4 `z.record()` needs both key+value schemas | 0 | Fixed |
| AI SDK v6 uses `maxOutputTokens` not `maxTokens` | 0 | Fixed |
| shadcn Select `onValueChange` can pass `null` in v4 | 0 | Fixed |
| Next.js 16 deprecates `middleware` in favor of `proxy` (warning only) | 0 | Noted |
| Research notes lack `deletedAt` — orphaned after client soft-delete | 1 | Tech debt (Phase 2) |
| `getProcessWithFullContext` does NOT filter soft-deleted children | 1 | Tech debt — UI must filter |
| Supabase `information_schema.sessions` mixes auth.sessions columns | 1 | Noted — no impact |
| AI research polling uses 5s setTimeout | No real-time channel; acceptable for Phase 2, consider SSE in later phases | 2 | Tech debt |
| `listClients` filter wraps single string in array | Route wraps `searchParams.get('status')` in `[status]` to match query layer's `string[]` type | 2 | Works — may want multi-select later |
| `client-detail-card.tsx` mutateClient type error | `mutateClient` called with 2 args but typed for 0 — pre-existing from Phase 2 | 3 | Tech debt |
| Clerk testing Playwright auth broken with proxy.ts | `clerk.signIn()` doesn't work with Next.js 16 `proxy.ts` — E2E tests can't authenticate programmatically | 3 | Tech debt — wait for Clerk update |
| Zod v4 strict UUID validation in tests | Test UUIDs like `00000000-0000-...` fail Zod v4 RFC 4122 checks; use `crypto.randomUUID()` for test data | 4 | Fixed |
| openQuestions column is `text` not `question` | Plan assumed `question` column but actual schema uses `text` | 4 | Fixed in apply route |
| processModels version column skipped | Snapshots provide history; version column unnecessary for v1 | 4 | Decision |

---

## Environment Variables Status

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Set |
| `CLERK_SECRET_KEY` | ✅ Set |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ Set |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ Set |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | ✅ Set |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | ✅ Set |
| `DATABASE_URL` | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |

*(Update to ✅ as each is added to .env.local)*

---

## Session Log

| Date | Phase/Step | What Was Done | Issues |
|------|------------|---------------|--------|
| 2026-03-08 | 0.1–0.8 | Full Phase 0 implementation: scaffold, auth, layout, settings, tests (42 passing), build passes | Zod v4/AI SDK v6/shadcn v4 API differences from plan |
| 2026-03-10 | 1.1–1.6 | Full Phase 1: schema (11 tables, 9 enums), JSONB types, query layer (8 files), migration pushed to Supabase, seed data verified. 63 tests passing, build clean. | Supabase MCP not available — verified via direct SQL connection |
| 2026-03-11 | 2.1–2.8 | Full Phase 2: client CRUD API (5 routes), contacts CRUD API (5 routes), company research AI, SWR hooks, client list page, create dialog, overview page with inline edit + AI summary + contacts. 107 tests passing, build clean. | AI SDK v6 `maxSteps` → `stopWhen`, shadcn v4 no `asChild`, SWR v2 `globalMutate` limitation |
| 2026-03-11 | 3.1–3.6 | Full Phase 3: L1 domain JSON (procurement + unknown), hypothesis AI with fire-and-forget, process CRUD API (3 routes: list/create, detail/patch/delete, hypothesis regenerate), creation dialog, process overview (detail card + hypothesis card + process flow + step cards + system badges), breadcrumb UUID resolution for processes. 157 tests passing (50 new), build clean. | Race condition in hypothesis write order (steps after hypothesisText), requireAuthWithUser needed for API key access, Zod v4 no SafeParseSuccess export |

| 2026-03-16 | 4.0–4.8 | Full Phase 4: schema audit (3 columns + synthesis_done status), session CRUD API (5 routes), SWR hooks, sessions list, creation dialog (3-step with type selector + AI interview), AI interview route (3 adaptive questions), session detail page (transcript + notes with 2s debounced auto-save), prep brief AI, synthesis AI, synthesis display (4 collapsible panels with section toggles), apply-synthesis route (transaction with snapshot + merge + open questions). 257 tests passing (100 new), build clean. | Zod v4 strict UUID validation, vi.mock hoisting with variable references, session type enum differs from plan |

| 2026-03-21 | 5.1–5.8 | Phase 5 (steps 1-8): event type constants + UI config, events API (single + batch + patch), suggestions AI route (never 500), capture page with (capture) route group (full-screen, no sidebar), 10 capture UI components (header, event-type-bar, observation-input, system-picker, suggestion-chips, event-log-panel, analytics-sidebar, confirm-end-dialog, post-capture-screen, capture-view), useEventSync hook (offline queue + batch sync + server ID mapping), useSuggestions hook (debounced with timeout), "Iniciar Captura" button on session detail. 399 tests passing (142 new), build clean. | EVENT_TYPES_MUTABLE Zod cast, AI SDK v6 maxOutputTokens, shadcn v4 no asChild on PopoverTrigger, no middleware.ts (auth via utils) |

*(Claude Code appends a line here after each session)*