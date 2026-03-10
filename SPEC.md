# FDE Discovery Tool — SPEC.md

> **This file is updated after every completed step.**
> Claude Code reads this at the start of every session to understand current state.
> Alberto owns the content. Claude Code owns the updates (with approval).

---

## Current State

```
Phase:          1 — Database Schema & ORM (COMPLETE)
Last Completed: Step 1.6 — Seed script
Next Step:      Phase 2 / Step 2.1 — Write API tests (RED)
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
- [ ] 2.1 — Write API tests (RED)
- [ ] 2.2 — Client API routes (GET list, POST create, GET by ID, PATCH, DELETE)
- [ ] 2.3 — Company research AI (uses user's key, NO_API_KEY handled)
- [ ] 2.4 — Client list page
- [ ] 2.5 — Client creation form
- [ ] 2.6 — Client overview (inline edit, contacts, processes)
- [ ] 2.7 — Contacts CRUD
- [ ] 2.8 — SWR hooks

### Phase 3 — Process CRUD + Hypothesis
- [ ] 3.1 — L1 domain JSON files (procurement + unknown minimum)
- [ ] 3.2 — Hypothesis AI (user's key + model)
- [ ] 3.3 — Process API routes
- [ ] 3.4 — Process creation form
- [ ] 3.5 — Process overview + ProcessModel flow component
- [ ] 3.6 — System badges with detailNotes tooltip

### Phase 4 — Session Lifecycle (Non-Shadowing)
- [ ] 4.1 — Session creation: type selector
- [ ] 4.2 — Session creation: structured fields (per type)
- [ ] 4.3 — Session creation: AI interview (3 adaptive questions)
- [ ] 4.4 — Session API routes
- [ ] 4.5 — Prep brief generation
- [ ] 4.6 — Session detail page (transcript + notes textareas, auto-save)
- [ ] 4.7 — Non-shadowing synthesis (transcript + notes → synthesis)
- [ ] 4.8 — Synthesis display panels

### Phase 5 — Shadowing Capture
- [ ] 5.1 — Capture page (full-screen, 65/35 split)
- [ ] 5.2 — Capture buttons component (5 buttons)
- [ ] 5.3 — Input panel with suggestion chips (Haiku model)
- [ ] 5.4 — SYSTEM picker with detail notes field
- [ ] 5.5 — Event log panel (auto-scroll, color coded)
- [ ] 5.6 — Suggestions AI route (NO_API_KEY → empty suggestions, never crash)
- [ ] 5.7 — Offline queue + sync
- [ ] 5.8 — Post-capture screen (transcript + notes before debrief)
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

*(Claude Code appends a line here after each session)*