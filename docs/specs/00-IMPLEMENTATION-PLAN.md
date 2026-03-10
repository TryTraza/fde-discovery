# FDE Discovery Tool — Implementation Plan

**Date:** 2026-03-09
**Based on:** Product Specification v3.1
**Architecture:** Full Next.js monolith on Vercel

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         VERCEL                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               Next.js 15 (App Router)                   │  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │  │
│  │  │  React UI    │  │  API Routes   │  │  Middleware   │  │  │
│  │  │  shadcn/ui   │  │  /api/*       │  │  Clerk Auth  │  │  │
│  │  │  AI Elements │  │               │  │              │  │  │
│  │  └──────┬───────┘  └───────┬───────┘  └──────────────┘  │  │
│  │         │                  │                             │  │
│  │         │     ┌────────────┴──────────────┐              │  │
│  │         │     ▼                           ▼              │  │
│  │         │  ┌──────────┐    ┌────────────────────────┐    │  │
│  │         │  │ Drizzle  │    │  Vercel AI SDK         │    │  │
│  │         │  │ ORM      │    │  @ai-sdk/anthropic     │    │  │
│  │         │  └────┬─────┘    │  user's API key        │    │  │
│  │         │       │          │  user's model config   │    │  │
│  │         │       │          └────────────┬───────────┘    │  │
│  └─────────┼───────┼──────────────────────┼────────────────┘  │
│            │       ▼                      ▼                   │
└────────────┼──┌──────────┐    ┌──────────────────────┐────────┘
             │  │ Supabase │    │ Claude API            │
             │  │ Postgres │    │ (billed to user's key)│
             │  │ + Storage│    └──────────────────────┘
             │  └──────────┘
             ▼
        Browser / iPad
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | Next.js API Routes (no FastAPI) | Single repo, AI SDK native, no CORS |
| ORM | Drizzle ORM | Type-safe schema-as-code with migrations |
| AI | Vercel AI SDK + `@ai-sdk/anthropic` | Streaming, `useChat`, `generateObject`, built-in web search tool |
| AI Keys | Per-user in Clerk `privateMetadata` | Each user pays their own Claude costs |
| AI Models | Per-feature selection in Clerk `publicMetadata` | Haiku for speed, Sonnet for quality |
| Auth | Clerk middleware (no Supabase RLS) | Server-side auth on all routes, 2-user app |
| DB | Supabase PostgreSQL via Drizzle | Managed Postgres + storage buckets |
| UI | shadcn/ui + AI Elements | Pre-built components, AI-native chat |
| Deploy | Vercel | Edge middleware, streaming, serverless |
| Testing | Vitest + Playwright | Unit/integration + E2E |

## Build Phases

| Phase | Name | Days | Deliverable |
|-------|------|------|-------------|
| 0 | Project Setup & Infrastructure | 2 | Skeleton with auth + Settings page |
| 1 | Database Schema & ORM | 2 | All tables, migrations, query layer, seed |
| 2 | Client CRUD + Company Research | 3 | Client list, creation, AI research |
| 3 | Process CRUD + Hypothesis | 3 | Process creation, ProcessModel flow |
| 4 | Session Lifecycle (non-shadowing) | 4 | Creation, interview, prep brief, transcript+notes, synthesis |
| 5 | Shadowing Capture | 4 | Live capture, system detail notes, suggestions, offline |
| 6 | Post-Session: Debrief + Synthesis | 3 | Debrief flow, synthesis engine, apply changes |
| 7 | AI Research Panel + Polish | 3 | Research slide-out, email drafts, artifacts, viewer role |

**Total: ~24 working days (5 weeks)**

## Documents

| File | Contents |
|------|----------|
| `00-IMPLEMENTATION-PLAN.md` | This file |
| `01-PHASE-0-SETUP.md` | Scaffolding, dependencies, auth, Settings page, deploy |
| `02-PHASE-1-DATABASE.md` | Complete Drizzle schema, JSONB types, relations, queries, seed |
| `03-PHASE-2-CLIENTS.md` | Client CRUD, contacts, company research AI |
| `04-PHASE-3-PROCESSES.md` | Process CRUD, L1 domain library, hypothesis AI, flow view |
| `05-PHASE-4-SESSIONS.md` | Session creation, interview, prep brief, transcript+notes, synthesis |
| `06-PHASE-5-SHADOWING.md` | Live capture UI, system detail notes, suggestions, offline |
| `07-PHASE-6-DEBRIEF-SYNTHESIS.md` | Post-session debrief, full synthesis engine, apply changes |
| `08-PHASE-7-POLISH.md` | Research panel, email drafts, artifacts, viewer role |
| `09-TECH-REFERENCE.md` | Per-user AI key pattern, model resolver, API route patterns, error handling |

## Conventions

### Test-First Workflow (MANDATORY)
1. Write the test FIRST
2. Run → confirm RED
3. Implement minimum code to pass
4. Refactor
5. Full test suite

### File Naming
- Pages: `app/(dashboard)/clients/page.tsx`
- API routes: `app/api/clients/route.ts`
- Components: `components/clients/client-card.tsx` (kebab-case)
- DB schema: `lib/db/schema.ts`
- DB queries: `lib/db/queries/clients.ts`
- AI prompts: `lib/ai/prompts/company-research.ts`

### Commit Convention
```
feat(clients): add client creation form
test(clients): add client creation API tests
fix(sessions): handle empty transcript in synthesis
```
