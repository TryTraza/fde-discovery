# FDE Discovery Tool — Implementation Plan v2

**Version:** 2.0
**Date:** 2026-03-08
**Based on:** Product Specification v3.1 + Alberto's refinements
**Architecture:** Full Next.js monolith on Vercel

---

## What Changed from v1

| Change | Impact | Affected Phases |
|--------|--------|-----------------|
| **Transcript + Notes on all sessions** | Session schema adds `notes` field. Session Detail shows both textarea for pasted transcript AND textarea for personal notes. Both feed into synthesis. After shadowing capture ends, user lands on a screen where they can paste transcript AND add notes before proceeding to debrief. | 1, 4, 5, 6 |
| **System detail notes (Excel columns, sheets, mappings)** | `SystemEntry` JSONB gets a `detailNotes` free-text field. During shadowing, after SYSTEM button picks a system, an optional notes field appears ("e.g. Column A = Supplier, Sheet: Quotes2024"). Phase 2 will structure this into proper schema metadata. | 1, 5, 6 |
| **Per-user API keys (Clerk metadata)** | No server-side `ANTHROPIC_API_KEY`. Each user stores their Anthropic key in Clerk `privateMetadata`. Every AI route reads the key from the authenticated user's Clerk profile. Settings page allows entering/updating the key. If no key → AI features disabled with clear message. | 0, 1, 4, 5, 6, 7 |
| **Per-feature model selection** | Settings page has model selectors for 5 feature categories: Research, Hypothesis, Suggestions, Synthesis, Interview. Defaults provided. Stored in Clerk `publicMetadata`. Every AI call resolves model from user settings. | 0, 2, 3, 4, 5, 6, 7 |

---

## Architecture Overview

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
│  │         │     │                           │              │  │
│  │         │     ▼                           ▼              │  │
│  │         │  ┌──────────┐    ┌────────────────────────┐    │  │
│  │         │  │ Drizzle  │    │  Vercel AI SDK         │    │  │
│  │         │  │ ORM      │    │  @ai-sdk/anthropic     │    │  │
│  │         │  └────┬─────┘    │  + user's API key      │    │  │
│  │         │       │          │  + user's model config  │    │  │
│  │         │       │          └────────────┬───────────┘    │  │
│  └─────────┼───────┼──────────────────────┼────────────────┘  │
│            │       │                      │                   │
└────────────┼───────┼──────────────────────┼───────────────────┘
             │       │                      │
             │       ▼                      ▼
             │  ┌──────────┐    ┌──────────────────────┐
             │  │ Supabase │    │ Claude API            │
             │  │ Postgres │    │ (billed to user's key)│
             │  │ + Storage│    └──────────────────────┘
             │  └──────────┘
             ▼
        Browser / iPad
```

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | Next.js API Routes (no FastAPI) | Single repo/deploy, AI SDK native |
| ORM | Drizzle ORM | Type-safe schema-as-code, migrations |
| AI | Vercel AI SDK + `@ai-sdk/anthropic` | Streaming, `useChat`, `generateObject`, built-in web search tool |
| AI Keys | Per-user in Clerk `privateMetadata` | Each user pays their own Claude costs |
| AI Models | Per-feature selection in Clerk `publicMetadata` | Cost optimization (Haiku for suggestions, Sonnet for synthesis) |
| Auth | Clerk (middleware-only, no Supabase RLS) | Server-side auth on all API routes |
| DB | Supabase PostgreSQL via Drizzle | Managed Postgres, storage buckets |
| UI | shadcn/ui + AI Elements | Pre-built components, AI-native chat |
| Deploy | Vercel | Edge middleware, streaming, serverless |
| Testing | Vitest + React Testing Library + Playwright | Unit → Integration → E2E |

## Build Phases

| Phase | Name | Est. Days | Key Deliverable |
|-------|------|-----------|-----------------|
| 0 | Project Setup & Infrastructure | 2 | Running skeleton with auth + settings |
| 1 | Database Schema & ORM | 2 | All tables, migrations, typed queries |
| 2 | Client CRUD + Company Research | 3 | Client list, creation, AI research |
| 3 | Process CRUD + Hypothesis | 3 | Process creation, ProcessModel flow view |
| 4 | Session Lifecycle (non-shadowing) | 4 | Session creation, interview, prep brief, transcript+notes, synthesis |
| 5 | Shadowing Capture | 4 | Live capture UI, system notes, suggestions, offline |
| 6 | Post-Session: Debrief + Synthesis | 3 | Debrief flow, shadowing synthesis, apply changes |
| 7 | AI Research Panel + Polish | 3 | Research slide-out, email drafts, artifacts, viewer role |

**Total: ~24 working days (5 weeks)**

## Document Index

| File | Contents |
|------|----------|
| `00-IMPLEMENTATION-PLAN.md` | This file — master overview |
| `01-PHASE-0-SETUP.md` | Scaffolding, deps, auth, settings page, deploy |
| `02-PHASE-1-DATABASE.md` | Drizzle schema, migrations, query layer |
| `03-PHASE-2-CLIENTS.md` | Client CRUD, contacts, company research AI |
| `04-PHASE-3-PROCESSES.md` | Process CRUD, hypothesis AI, ProcessModel flow |
| `05-PHASE-4-SESSIONS.md` | Session lifecycle, interview, prep brief, transcript+notes, synthesis |
| `06-PHASE-5-SHADOWING.md` | Live capture, system detail notes, suggestions, offline |
| `07-PHASE-6-DEBRIEF-SYNTHESIS.md` | Post-session debrief, synthesis engine |
| `08-PHASE-7-POLISH.md` | Research panel, email drafts, artifacts, viewer role |
| `09-TECH-REFERENCE.md` | AI patterns, Zod schemas, per-user key helper, model resolver |

## Conventions

### Test-First Workflow (MANDATORY)
1. Write the test FIRST
2. Run → confirm RED
3. Implement minimum code to pass
4. Refactor
5. Full test suite

### Commit Convention
```
feat(clients): add client creation form
test(clients): add client creation API tests
fix(sessions): handle empty transcript in synthesis
```

### File Naming
- Pages: `app/(dashboard)/clients/page.tsx`
- API routes: `app/api/clients/route.ts`
- Components: `components/clients/client-card.tsx` (kebab-case)
- DB schema: `lib/db/schema.ts`
- AI prompts: `lib/ai/prompts/company-research.ts`
