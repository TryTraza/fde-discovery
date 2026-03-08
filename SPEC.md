# FDE Discovery Tool — SPEC.md

> **This file is updated after every completed step.**
> Claude Code reads this at the start of every session to understand current state.
> Alberto owns the content. Claude Code owns the updates (with approval).

---

## Current State

```
Phase:          0 — Project Setup & Infrastructure
Last Completed: (not started)
Next Step:      Phase 0 / Step 0.1 — Scaffold Next.js project
Blocker:        None
```

---

## Phase Completion Tracker

### Phase 0 — Setup & Infrastructure
- [ ] 0.1 — Scaffold Next.js project + install dependencies
- [ ] 0.2 — Project directory structure created
- [ ] 0.3 — `.env.local` configured (Clerk + Supabase + no Anthropic key)
- [ ] 0.4 — Drizzle config + DB client
- [ ] 0.5 — Clerk auth setup (root layout, middleware, sign-in/sign-up pages)
- [ ] 0.6 — Vitest configuration
- [ ] 0.7 — Dashboard layout shell (sidebar + breadcrumb placeholder)
- [ ] 0.8 — Settings page (API key input + model selection + test key button)
- [ ] 0.9 — Verify: app runs locally, Clerk login works, Vercel deploy succeeds

### Phase 1 — Database Schema & ORM
- [ ] 1.1 — Write schema tests (RED)
- [ ] 1.2 — Define full schema (`schema.ts`)
- [ ] 1.3 — JSONB type definitions (`types.ts`)
- [ ] 1.4 — Generate & apply migration to Supabase
- [ ] 1.5 — Query layer (all entities)
- [ ] 1.6 — Seed script

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
| — | — | — |

---

## Environment Variables Status

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ⬜ Not set |
| `CLERK_SECRET_KEY` | ⬜ Not set |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ⬜ Not set |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ⬜ Not set |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | ⬜ Not set |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | ⬜ Not set |
| `DATABASE_URL` | ⬜ Not set |
| `NEXT_PUBLIC_SUPABASE_URL` | ⬜ Not set |
| `SUPABASE_SERVICE_ROLE_KEY` | ⬜ Not set |

*(Update to ✅ as each is added to .env.local)*

---

## Session Log

| Date | Phase/Step | What Was Done | Issues |
|------|------------|---------------|--------|
| — | — | — | — |

*(Claude Code appends a line here after each session)*