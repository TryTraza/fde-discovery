# FDE Discovery Tool — Product Specification v3.1

**Owner:** Alberto (FDE)
**Audience:** Alberto + Founders + Developer
**Status:** Production spec — ready for build
**Build:** 3 phases, 8–10 weeks

> The operating system for AI worker discovery, process capture, and POC delivery.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Product Vision](#2-product-vision)
3. [Memory Architecture](#3-memory-architecture)
4. [Data Model](#4-data-model)
5. [Auth & Permissions](#5-auth--permissions)
6. [Navigation & Layout](#6-navigation--layout)
7. [Screens — Phase 1](#7-screens--phase-1)
8. [AI Features — Prompts & Output Schemas](#8-ai-features--prompts--output-schemas)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)
10. [Integrations](#10-integrations)
11. [Tech Stack & Infrastructure](#11-tech-stack--infrastructure)
12. [Build Phases](#12-build-phases)
13. [Open Questions](#13-open-questions)

---

## Changelog v3.0 → v3.1

- **L1 Domain Library clarified.** L1 is invisible infrastructure — the user never browses it. It's a set of JSON files the AI uses behind the scenes to make every feature smarter. Domain Library screen removed from Phase 1. Moved to Phase 2 as an admin editor.
- **Company research improved.** AI always runs web research on client creation (not just when a website is provided). Website is an optional extra input. Research uses company name + industry + website (if provided). The user can also trigger additional research anytime via the AI Research panel.
- **Snapshots clarified.** Snapshots are internal database backups of the ProcessModel state, taken automatically before any AI-driven change. The user never sees or manages them. They exist purely as a safety net for data recovery.
- **Session setup redesigned.** Replaced the goals textarea with a hybrid approach: structured form fields (date, contacts, type-specific data) + a short AI-guided interview (2–3 adaptive questions based on process state). This extracts more useful context without the open-endedness of a pure chat.
- **Added QUESTION button to shadowing.** Fifth capture button for logging questions and doubts during observation. After ending the session, a post-session debrief screen walks through all QUESTION and unlabeled IMPLICIT events before synthesis runs.
- **Data model updated.** EventLog now supports `QUESTION` type. New `debrief_answers` field on Session for storing debrief responses.

---

## 1. Problem Statement

Forward Deployed Engineers at Traza AI spend the majority of their pre-POC time on activities that do not directly produce value: internalizing process knowledge from scattered notes, conducting unstructured shadowing sessions with no real-time capture tool, manually classifying example artifacts after the fact, and discovering critical edge cases only at demo time.

**Core contradiction:** As an AI company, Traza FDEs still use a notebook and pen to understand client processes.

### Pain points validated (Omatapalo engagement)

| Pain Point | Time Lost | Root Cause |
|---|---|---|
| Pre-internalization before each visit | 1–2 hours | Context scattered across Slack, Excalidraw, personal notes |
| Shadowing with no structured capture | 30–60 min reconstruction | Mental notes, no real-time logging tool |
| Manual artifact classification | 1+ hour per artifact batch | No labeling framework tied to process steps |
| Edge cases discovered at demo | Rework entire POC section | No systematic surfacing during capture |
| Context lost between engagements | Repeated onboarding effort | No persistent client knowledge base |
| No structured research before meetings | Unprepared questions, missed context | No AI-assisted research tied to client/process |

---

## 2. Product Vision

The FDE Discovery Tool serves four functions:

1. **Client & process tracker** — easily register clients, track process status, and navigate context.
2. **AI research assistant** — on-demand research at any point: industry context, company information, process patterns. Uses web search + domain knowledge.
3. **Session lifecycle manager** — prepare, capture, and synthesize every session type. AI helps before (prep brief with tailored questions), during (live capture or transcript paste), and after (structured synthesis).
4. **Synthesis engine** — converts raw session data into structured process models, visual flows, edge case registries, and open question lists.

> **Design principle:** The tool does not replace the shadowing session. It eliminates everything around it.

### What's NOT in scope

This tool is for the FDE's internal workflow. It is not a client-facing portal, not a project management tool, and not an AI worker builder. It feeds into those things but does not attempt to be them.

---

## 3. Memory Architecture

Every AI feature operates with three stacked context layers.

| Layer | Scope | Contents | How It Grows |
|---|---|---|---|
| **L1 — Domain** | Global | Process type templates, common step sequences, edge case libraries, system catalogs, question banks | Seeded manually before launch as structured JSON. The user never sees L1 directly — it works behind the scenes to make every AI feature smarter. |
| **L2 — Client** | Per client | Industry, confirmed systems, contacts, confirmed process steps, resolved questions, research notes | Grows with every session, artifact confirmation, and research interaction. |
| **L3 — Session** | Per session | Interview answers, session type, who's being shadowed, gaps from prior sessions | Created at session setup. Consumed during capture and synthesis. |

### L1 Domain Library — what it is and how it works

L1 is **invisible infrastructure**. The user never browses or interacts with it. It's a set of JSON files that encode Alberto's domain expertise — things like "in a procurement process, after receiving a supplier quote, the typical next step is comparing it against previous quotes in Excel" or "common edge case: supplier responds with price in a different currency."

Every AI call (prep brief, capture suggestions, synthesis, research) includes the relevant L1 process type data in its system prompt. This is what makes the AI "know about procurement" instead of giving generic answers.

**How it's used in practice:**
- When generating a prep brief for a procurement shadowing session, the AI reads L1's `typical_steps` for procurement and says "watch for how she handles currency mismatches" — because L1's edge case library lists that as common.
- When generating capture suggestions during shadowing, the AI reads L1 to predict that after "opens supplier email" the next step is probably "checks price against budget" — because L1's step sequence says so.
- When running synthesis, the AI uses L1's `typical_steps` to identify steps that were probably skipped during observation — marking them as `missing` in the ProcessModel.

**The user experience is:** "the AI somehow knows about my process type." That's L1 working.

### L1 Schema

Stored as JSON files on the backend, one per process type. Loaded at app start.

```json
{
  "process_type": "procurement",
  "display_name": "Procurement / Purchasing",
  "description": "End-to-end process from need identification to supplier payment.",
  "typical_steps": [
    {
      "order": 1,
      "name": "Need identification",
      "description": "Internal request triggers procurement. Can be manual form, email, or ERP requisition.",
      "common_systems": ["ERP", "Email", "Excel"],
      "common_edge_cases": [
        "Urgent request bypasses approval chain",
        "Requestor uses wrong category code"
      ]
    }
  ],
  "common_systems": ["SAP", "Oracle", "SharePoint", "Excel", "Email", "ERP"],
  "common_edge_cases": [
    {
      "description": "Supplier responds with price in different currency",
      "frequency": "occasional",
      "typical_handling": "Manual conversion or flag for review"
    }
  ],
  "question_bank": {
    "discovery": ["How many suppliers do you typically evaluate per purchase?"],
    "shadowing": ["Watch for: where does she look up previous correspondence?"],
    "validation": ["Is this the complete list of systems involved?"]
  }
}
```

Alberto seeds 3 process types before launch: **procurement**, **freight forwarding**, **rebate processing**. A generic `unknown` type is used as fallback when no match exists.

No Domain Library UI screen in Phase 1. [P2]: Admin editor for L1 content.

### How layers combine for AI calls

Every AI call receives a system prompt constructed as:

```
[Base system prompt for the feature]
[L1: full JSON of the matching process type, or "unknown" fallback]
[L2: client summary — industry, systems, contacts, process status, recent session summaries, research notes]
[L3: session-specific context — interview answers, type, contacts present, gaps]
```

Total context estimated at 2,000–8,000 tokens per call. Well within Claude Sonnet's context window.

---

## 4. Data Model

### Common fields

Every entity has these fields unless noted otherwise:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. Generated server-side. |
| `created_at` | timestamp with timezone | Set on creation. Immutable. |
| `updated_at` | timestamp with timezone | Updated on every write. |

**Soft delete:** All entities use soft delete (`deleted_at` timestamp, null when active). Deleting a Client cascade soft-deletes all children (Contacts, Processes, Sessions, etc.). Soft-deleted records are excluded from all queries and UI. No hard delete in Phase 1.

### Entity definitions

#### Client

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | text | yes | Company name. |
| `industry` | text | yes | Free text. UI provides dropdown with common values + free-text fallback. |
| `website` | text | no | Optional. Used as additional input for AI company research, not the sole source. |
| `hq_location` | text | no | City / country. |
| `notes` | text | no | Free text. |
| `status` | enum | yes | `prospecting` / `active_poc` / `demo_ready` / `closed`. Default: `prospecting`. |
| `ai_summary` | text | no | AI-generated company research summary. Always generated on creation (uses web search on company name + industry, plus website if provided). Editable by user. |

#### Contact

| Field | Type | Required | Notes |
|---|---|---|---|
| `client_id` | UUID FK | yes | References Client. |
| `name` | text | yes | Full name. |
| `role` | text | no | Job title. |
| `department` | text | no | Free text. Used for grouping/filtering. |
| `email` | text | no | |
| `phone` | text | no | |
| `notes` | text | no | |

#### Process

| Field | Type | Required | Notes |
|---|---|---|---|
| `client_id` | UUID FK | yes | References Client. |
| `name` | text | yes | e.g. "Supplier Quote Intake" |
| `department_tag` | text | no | Free text, autocomplete from existing tags within client. |
| `description` | text | no | User-provided description. Even one sentence is fine. |
| `status` | enum | yes | `draft` → `mapping` → `validated` → `locked`. Default: `draft`. Manual transitions via dropdown. |
| `hypothesis_text` | text | no | AI-generated on creation. Plain-language paragraph. |
| `process_type_l1` | text | no | Key into L1 domain library. Auto-matched by AI from description. Default: `unknown`. |

#### ProcessModel

One-to-one with Process. Created automatically when a Process is created.

| Field | Type | Required | Notes |
|---|---|---|---|
| `process_id` | UUID FK | yes | References Process. Unique constraint. |
| `steps` | JSONB | yes | Array of ProcessStep objects. Default: `[]`. |
| `edge_cases` | JSONB | yes | Array of EdgeCase objects. Default: `[]`. |
| `systems` | JSONB | yes | Array of SystemEntry objects. Default: `[]`. |

**Snapshots** are automatic database backups of the ProcessModel, taken before any AI-driven change (synthesis apply, validation merge). They are stored in a separate table, not in the ProcessModel itself. The user never sees, manages, or interacts with snapshots. They exist purely so the developer can recover data if an AI patch goes wrong.

#### ProcessModelSnapshot (internal — no UI)

| Field | Type | Required | Notes |
|---|---|---|---|
| `process_model_id` | UUID FK | yes | References ProcessModel. |
| `trigger` | text | yes | What caused the snapshot: `synthesis_apply` / `validation_merge`. |
| `session_id` | UUID FK | no | Which session triggered the change. |
| `state` | JSONB | yes | Full copy of `steps`, `edge_cases`, `systems` at that moment. |

No UI for viewing snapshots. They are only used for manual data recovery by the developer if needed.

**ProcessStep schema:**

```json
{
  "id": "step_001",
  "order": 1,
  "name": "Open supplier email",
  "description": "Operator opens the incoming email from the supplier in Outlook.",
  "confidence": "confirmed",
  "source_session_id": "uuid-of-session",
  "systems": ["Email"],
  "next_steps": ["step_002"],
  "branch_condition": null,
  "related_edge_cases": ["edge_001"],
  "notes": ""
}
```

- `confidence`: `confirmed` (explicitly logged as STEP) / `inferred` (AI derived from L1 or transcript) / `missing` (AI believes must exist but never captured).
- `next_steps`: array of step IDs. One entry = linear flow. Multiple entries = branch (with `branch_condition` describing the fork).

**EdgeCase schema:**

```json
{
  "id": "edge_001",
  "description": "Supplier responds without price in email body",
  "frequency": "occasional",
  "suggested_handling": "Flag for manual review, request updated quote",
  "status": "open",
  "source_session_id": "uuid",
  "related_step_id": "step_003"
}
```

- `frequency`: `rare` / `occasional` / `frequent` / `unknown`.
- `status`: `open` / `needs_clarification` / `resolved`.

**SystemEntry schema:**

```json
{
  "name": "SharePoint",
  "confirmed": true,
  "role": "Document storage for proformas",
  "details": "/Proformas/Pending folder",
  "gaps": "Unknown: who has write access? What naming convention?",
  "source_session_id": "uuid"
}
```

#### Session

| Field | Type | Required | Notes |
|---|---|---|---|
| `process_id` | UUID FK | yes | References Process. |
| `type` | enum | yes | `discovery` / `process_mapping` / `shadowing` / `validation` / `demo` |
| `date` | date | yes | Scheduled date. |
| `status` | enum | yes | `planned` / `in_progress` / `completed`. Default: `planned`. |
| `interview_answers` | JSONB | no | Structured output from the AI-guided session setup interview. Schema: `{ "questions": [{ "question": "...", "answer": "..." }] }`. Replaces the old free-text goals field. |
| `prep_brief` | JSONB | no | Generated after session setup. Regenerable on demand. |
| `transcript_text` | text | no | Granola transcript or manual notes. Plain text. |
| `ai_summary` | text | no | One-line summary generated by synthesis. |
| `synthesis_output` | JSONB | no | Full synthesis result. Null until synthesis runs. |
| `debrief_answers` | JSONB | no | Shadowing only. Responses from the post-session debrief. Schema: see Section 7.9. |

**Session ↔ Contact:** Many-to-many via `session_contacts` join table (`session_id`, `contact_id`, `role_in_session` text — e.g. "shadowed", "attended", "presented to").

**Shadowing-specific fields** (stored in Session as JSONB `shadowing_config`):

```json
{
  "person_shadowed_contact_id": "uuid",
  "focus_area": "full_flow",
  "gaps_to_fill": ["question_id_1", "question_id_2"]
}
```

**Validation-specific fields** (`validation_config` JSONB):

```json
{
  "steps_to_validate": ["step_001", "step_003", "step_005"]
}
```

**Demo-specific fields** (`demo_config` JSONB):

```json
{
  "scenarios": "Free text describing demo scenarios",
  "known_edge_cases": "Free text"
}
```

#### EventLog

| Field | Type | Required | Notes |
|---|---|---|---|
| `session_id` | UUID FK | yes | References Session. Only for `shadowing` sessions. |
| `timestamp` | timestamp with timezone | yes | Exact time during the session. |
| `type` | enum | yes | `STEP` / `EDGE` / `SYSTEM` / `IMPLICIT` / `QUESTION` |
| `label` | text | no | Short description. Null for IMPLICIT events until labeled in debrief. |
| `detail` | text | no | Additional context. |
| `suggestion_used` | boolean | yes | `true` if user tapped a suggestion chip. Default: `false`. |

#### Artifact

| Field | Type | Required | Notes |
|---|---|---|---|
| `process_id` | UUID FK | yes | References Process. |
| `session_id` | UUID FK | no | Null if uploaded from Process Overview. |
| `filename` | text | yes | Original filename. |
| `storage_path` | text | yes | Path in Supabase Storage. |
| `file_size_bytes` | integer | yes | |
| `mime_type` | text | yes | |
| `source_description` | text | no | Free text. e.g. "Supplier response email from Maria". |
| `label` | text | no | Which process step this relates to. Free text in Phase 1. |
| `stage` | enum | no | `input` (triggers the process) / `intermediate` (created during) / `output` (final deliverable) / `reference` (supporting material). |
| `confirmed` | boolean | yes | Default: `false`. Confirmed artifacts eligible for eval dataset export. |

**Storage path:** `artifacts/{client_id}/{process_id}/{artifact_id}/{filename}`.

#### OpenQuestion

| Field | Type | Required | Notes |
|---|---|---|---|
| `process_id` | UUID FK | yes | References Process. |
| `session_id` | UUID FK | no | Null if manually created. |
| `text` | text | yes | The question. |
| `priority` | enum | yes | `critical` / `important` / `nice_to_have`. Set by AI during synthesis. Editable by user. |
| `status` | enum | yes | `open` → `sent` → `resolved`. Default: `open`. |
| `resolved_at` | timestamp | no | Set when status changes to `resolved`. |
| `resolution_notes` | text | no | What the answer was. |

#### ResearchNote

| Field | Type | Required | Notes |
|---|---|---|---|
| `client_id` | UUID FK | no | Null if domain-level research. |
| `process_id` | UUID FK | no | Null if client-level only. |
| `query` | text | yes | User's question. |
| `response` | text | yes | AI's full response (markdown). |
| `sources` | JSONB | yes | `[{ "url": "...", "title": "...", "snippet": "..." }]`. Empty array if no web sources. |

---

## 5. Auth & Permissions

| Role | Who | Can do |
|---|---|---|
| `admin` | Alberto | Full CRUD. Run synthesis. Use AI Research. Upload artifacts. Generate emails. |
| `viewer` | Founders | View everything: clients, processes, sessions (briefs, synthesis outputs), artifacts, open questions, research notes. **Cannot:** create, edit, delete, run synthesis, upload, use AI Research, generate emails. |

**Implementation:** Clerk handles auth. Role stored in Clerk user metadata: `{ "role": "admin" | "viewer" }`. Supabase RLS policies check the `role` claim from the Clerk JWT. `admin` = full access, `viewer` = SELECT only. Frontend hides write actions for viewers (UI convenience — real enforcement is RLS).

**Clerk ↔ Supabase:** Next.js API routes exchange the Clerk session token for a Supabase JWT with the role embedded as a claim.

---

## 6. Navigation & Layout

### Global layout

```
┌──────────────┬──────────────────────────────────────────┐
│  SIDEBAR     │  MAIN CONTENT                            │
│  (240px)     │                                          │
│              │  [Breadcrumb: Client > Process > Session] │
│  [Logo]      │                                          │
│              │  [Page content]                          │
│  Clients     │                                          │
│  Settings    │                                          │
│              │                                          │
│              │              [AI Research slide-out ───>] │
└──────────────┴──────────────────────────────────────────┘
```

- **Sidebar:** Always visible on desktop. Hamburger on tablet/mobile. Only two items in Phase 1: Clients and Settings. (Domain Library removed from Phase 1.)
- **Breadcrumb:** Full path, each segment clickable.
- **AI Research panel:** Slides from right. 400px wide. Overlays main content. Close on button or click-outside. Full-screen on mobile.

### Navigation depth

```
Client List → Client Overview → Process Overview → Session Detail
```

Three clicks from landing to any session. Processes filterable by `department_tag`.

### Mobile / tablet

- Sidebar collapses to hamburger.
- Shadowing capture is full-screen (no sidebar, no breadcrumb).
- All tap targets minimum 48x48px.
- AI Research panel is full-screen on mobile.

---

## 7. Screens — Phase 1

Phase 1 delivers 10 screens.

---

### 7.1 Client List

**Purpose:** Landing screen. Overview of all clients.

**Display:**
- Grid of client cards (3 columns desktop, 2 tablet, 1 mobile).
- Each card: `name`, `industry`, process count, last session date, `status` badge.
- Search bar: filters by `name` (case-insensitive substring).
- Filter dropdowns: `status` (multi-select), `industry` (multi-select from existing values).

**Actions:**
- `+ New Client` → Client Creation (7.2).
- Click card → Client Overview (7.3).

---

### 7.2 Client Creation — Form

**Purpose:** Register a new client.

**Fields:**

| Field | Input type | Required | Placeholder |
|---|---|---|---|
| Company name | text input | yes | "Acme Corp" |
| Industry | combobox (dropdown + free text) | yes | Dropdown: Manufacturing, Logistics, Retail, FMCG, Energy, Construction, Healthcare, Financial Services, Technology, Other |
| Website | URL input | no | "https://acme.com" |
| HQ location | text input | no | "Madrid, Spain" |
| Notes | textarea | no | "Met at trade show. Interested in procurement automation." |

**On save:**
1. Client created with `status: prospecting`.
2. AI company research triggered **always** (async, does not block). The AI searches the web using company name + industry + website (if provided). See Section 8.1. User navigated to Client Overview immediately. Summary shows loading skeleton until ready.
3. Navigate to Client Overview.

---

### 7.3 Client Overview

**Client profile card (top):**
- `name`, `industry`, `website` (link), `hq_location`, `notes` — all inline-editable.
- `status` dropdown (saves on change).
- **AI company research summary:** Text block below profile fields. Loading skeleton while generating. If failed: "Research unavailable — click to retry." Editable on click. A "Research more" button below the summary triggers a new, deeper web research (appends to existing summary, doesn't replace).

**Contacts section:**
- Table: name, role, department, email. Sortable by name.
- `+ Add Contact` inline row. Edit on click. Delete with confirmation.

**Processes section:**
- Filter bar: text search + `department_tag` dropdown filter.
- Process cards: `name`, `department_tag` label, `status` badge (draft=gray, mapping=blue, validated=green, locked=purple), confidence score, open question count, last session date.
- `+ New Process` → Process Creation (7.4).
- Click card → Process Overview (7.5).

**AI Research button:** Fixed bottom-right. Opens research panel (7.11) with client context.

---

### 7.4 Process Creation — Form

**Fields:**

| Field | Input type | Required | Placeholder |
|---|---|---|---|
| Process name | text input | yes | "Supplier Quote Intake" |
| Department tag | combobox | no | Autocomplete from existing tags + free text |
| Owner | contact picker | no | Client's contacts + "Add new" |
| Process type | combobox | no | "Procurement", "Freight Forwarding", "Rebate Processing", "Other". AI auto-matches from description. |
| Description | textarea | no | "The team receives supplier quotes via email, compares prices in Excel, and generates a purchase order." |
| Known systems | multi-select + free text | no | Checkboxes: Email, Excel, SharePoint, SAP, ERP, Browser, Phone + free text |
| Known pain points | textarea | no | "Quotes arrive in different formats." |

**On save:**
1. Process created with `status: draft`.
2. AI generates `hypothesis_text` + initial ProcessModel steps (see Section 8.2). Synchronous, loading spinner, 30s timeout.
3. If AI fails: process created anyway, `hypothesis_text` null, ProcessModel.steps empty. Retry button on Process Overview.
4. Navigate to Process Overview (7.5).

---

### 7.5 Process Overview

**Top section — ProcessModel card:**
- `status` dropdown + confidence badge (`"6/11 steps confirmed"`).
- Systems tags from ProcessModel.systems where `confirmed: true`.
- Open question count (clickable, scrolls to bottom).
- [P2] `Export to Excalidraw` button.

**Inline process flow view:**

Read-only vertical flow rendered from ProcessModel.steps[]:

```
┌─────────────────────────────────────┐
│  ● Step 1: Open supplier email      │  ← green border (confirmed)
│    Systems: Email                    │
│    Edge: No price in body            │
├─────────────────────────────────────┤
│         │                           │
│         ▼                           │
│  ● Step 2: Check previous quotes    │  ← yellow border (inferred)
│    Systems: Excel                   │
├─────────────────────────────────────┤
│         │                           │
│    ┌────┴────┐                      │
│    ▼         ▼                      │
│  [Price     [No price              │
│   present]   → request]            │  ← branch
│    │         │                      │
│    └────┬────┘                      │
│         ▼                           │
│  ◌ Step 4: Update comparison map    │  ← red dashed border (missing)
└─────────────────────────────────────┘
```

**Implementation:** React component. Each step is a card connected by vertical CSS borders/SVG lines. Branches fork with `branch_condition` text. Color coding: green=confirmed, yellow=inferred, red dashed=missing. Click step to expand: shows description, source session link, edge cases, related artifacts, notes (editable).

**Middle section — Sessions list:**
Vertical list, most recent first. Each card: type badge (Discovery=purple, Process Mapping=blue, Shadowing=green, Validation=orange, Demo=red), date, contacts, `ai_summary` (one line), status badge. Click → Session Detail (7.10).

`+ New Session` → Session Creation (7.6).

**Bottom section — Open Questions:**
Table: text, priority badge, status badge, source session link, resolved_at.
- Inline `Mark resolved` → textarea for resolution notes → saves.
- Checkbox column for follow-up email inclusion.
- `Generate follow-up email` → draft modal (see Section 8.6).
- `+ Add question` inline.

**AI Research button:** Bottom-right.

---

### 7.6 Session Creation — Type Selector + Hybrid Setup

**Purpose:** Create a new session. Three steps: type selection, structured fields, AI-guided interview.

#### Step 1 — Type selector

Five clickable cards:

| Type | Description |
|---|---|
| **Discovery** | First contact. Understand the company and identify processes. |
| **Process Mapping** | Align on scope with the manager. Confirm processes and assign contacts. |
| **Shadowing** | Silent observation. Capture the process as it actually happens. |
| **Validation** | Present the model back. They correct it step by step. |
| **Demo** | Show the AI worker. Capture feedback and gaps. |

#### Step 2 — Structured fields

**All types:**

| Field | Input type | Required | Notes |
|---|---|---|---|
| Date | date picker | yes | Default: today |
| Contacts present | multi-select contact picker | no | Client's contacts + "Add new" |

**Shadowing adds:**

| Field | Input type | Required | Notes |
|---|---|---|---|
| Person shadowed | single contact picker | yes | From session contacts |
| Focus area | radio buttons | yes | `Full flow` / `Specific steps` / `Edge cases only`. Default: `Full flow`. |
| Gaps to fill | checklist | no | Auto-populated from open questions. Checked items included in L3 context. |

**Validation adds:**

| Field | Input type | Required | Notes |
|---|---|---|---|
| Steps to validate | checklist | no | From ProcessModel.steps. Pre-checked: all non-confirmed steps. |

**Demo adds:**

| Field | Input type | Required | Notes |
|---|---|---|---|
| Scenarios | textarea | no | Free text |
| Known edge cases | textarea | no | Pre-populated from unresolved EdgeCases |

After filling structured fields, the user clicks "Continue" to proceed to Step 3.

#### Step 3 — AI-guided interview

A short, adaptive interview. The AI asks 2–3 questions based on the session type, process state, and what's already filled in. This replaces the old free-text "goals" field and extracts more focused context.

**How it works:**
1. The screen shows the first AI-generated question as a card with a text input below it.
2. The user types a short answer (1–3 sentences) and clicks "Next" or presses Enter.
3. The AI reads the answer and generates the next question (adaptive — it responds to what you said). Maximum 3 questions total. The AI can stop at 2 if it has enough context.
4. After the last question, a "Create Session" button appears.

**Example flow for a Shadowing session:**

> **AI:** "Your last session with Maria covered steps 1–5 but steps 6–8 (comparison mapping, approval routing, PO generation) are still inferred. Do you want to focus on those today, or is there something else?"
>
> **User:** "Yes, focus on 6-8, but also I want to understand what she does when a supplier doesn't respond at all."
>
> **AI:** "Got it — steps 6–8 plus the no-response edge case. You have 2 critical open questions from last session: 'What triggers the PO generation?' and 'Does the manager approve every PO or only above a threshold?' Should I include these in your suggested focus?"
>
> **User:** "Yes both. The threshold question is the most important one."
>
> **AI:** "Clear. Creating your session now."

**Example flow for a Discovery session:**

> **AI:** "This is your first session with {client_name}. What's the main thing you want to learn? For example: which processes to target, how their team is structured, or what systems they use."
>
> **User:** "I want to understand their procurement flow and figure out if there's enough pain to justify a POC."
>
> **AI:** "Makes sense. Do you already know who handles procurement, or is figuring out the right person part of the goal?"
>
> **User:** "I know the department head is Jorge. He'll be in the meeting."
>
> **AI:** "Got it. I'll prepare questions focused on procurement pain points and whether their current process is manual enough for automation. Creating your session."

**Implementation:** The interview is a Claude API call at each step. The prompt includes: session type, structured fields already filled, process state (ProcessModel, open questions, previous session summaries), L1 + L2 context. The AI is instructed to ask exactly 2–3 focused questions, not open-ended ones. See Section 8.3 for the prompt.

**Output:** Each question-answer pair is stored in `Session.interview_answers` as JSONB. These answers become part of the L3 context for the prep brief.

**On save (after interview completes):**
1. Session created with `status: planned`.
2. Session-contact relationships created.
3. AI generates prep brief from structured fields + interview answers (see Section 8.4). Stored in `prep_brief`.
4. Navigate to Session Detail (7.10).

---

### 7.7 Prep Brief (displayed within Session Detail)

The prep brief is the top section of Session Detail when the session is in `planned` status.

**Three sections, rendered from `prep_brief` JSONB:**

**1. WHAT WE KNOW**
- Confirmed process steps with confidence badges.
- Confirmed systems.
- Key contacts and roles.
- Relevant research notes (3 most recent, collapsible cards).

**2. WHAT'S OPEN**
- Inferred / missing steps listed with descriptions.
- Unresolved open questions, ordered by priority.

**3. SUGGESTED FOCUS**
- 5–10 specific, actionable items tailored to the session type and the user's interview answers. For shadowing: patterns to watch, systems to confirm. For non-shadowing: questions to ask, ordered by priority.

**Transcript paste area (below brief):**
- Textarea: "Paste your Granola transcript or type session notes here."
- Available at all times (before, during, after session).
- Auto-saves on blur (2s debounce).

**Actions:**
- `Regenerate brief` — re-runs AI generation.
- `Edit session` — returns to setup form (step 2 + 3) with fields pre-filled.

---

### 7.8 Shadowing Session — Live Capture

**Entry:** From Session Detail, click `Start Capture`. Screen transitions to full-screen mode. Sidebar, breadcrumb, and all navigation hidden.

**Layout:**

```
┌───────────────────────────────────┬──────────────────────┐
│  EVENT LOG (65%)                  │  CAPTURE (35%)       │
│                                   │                      │
│  09:14  ● STEP                    │  ┌────────────────┐  │
│  Opens email from supplier        │  │     STEP       │  │
│                                   │  └────────────────┘  │
│  09:16  ● IMPLICIT                │  ┌────────────────┐  │
│  [unlabeled]                      │  │     EDGE       │  │
│                                   │  └────────────────┘  │
│  09:19  ● EDGE                    │  ┌────────────────┐  │
│  No price in email body           │  │    SYSTEM      │  │
│                                   │  └────────────────┘  │
│  09:21  ● QUESTION                │  ┌────────────────┐  │
│  Why two folders?                 │  │   IMPLICIT     │  │
│                                   │  └────────────────┘  │
│                                   │  ┌────────────────┐  │
│                                   │  │   QUESTION     │  │
│                                   │  └────────────────┘  │
│                                   │                      │
│  ┌─ END SESSION ────────────────┐ │                      │
└───────────────────────────────────┴──────────────────────┘
          [INPUT PANEL — slides up on button tap]
```

**Left panel — Event log (65%):**
- Scrollable, newest at bottom (auto-scroll on new entry).
- Each entry: timestamp (HH:MM:SS), colored circle, label text.
- Colors: STEP=green, EDGE=orange, SYSTEM=blue, IMPLICIT=red, QUESTION=purple.
- Read-only during capture.
- `End Session` button — fixed bottom of left panel. Visible after first event. Click → confirmation dialog → transitions to Post-Session Debrief (7.9).

**Right panel — Capture buttons (35%):**
- **Five buttons** stacked vertically. Fixed position. Minimum 64px height each, full width. Color-coded left border.

#### Button behaviors

**STEP → input panel:**
1. Slides up input panel from bottom (overlays log, not buttons).
2. Suggestion row: 4–5 chips (AI-generated, see Section 8.5). Loading shimmer for max 1.5s, then text field only if slow.
3. Text field below: "Or type a step description..." Auto-focused.
4. Tap chip OR type + Enter → EventLog entry (`type: STEP`, `suggestion_used: true/false`).
5. Panel dismisses. Tap outside also dismisses (no log).

**EDGE → input panel:**
Same as STEP. Suggestions from L1 edge library + session edges. `type: EDGE`.

**SYSTEM → picker:**
1. 8 fixed buttons (2×4 grid): Email · Excel · SharePoint · SAP · ERP · Browser · Phone · Other.
2. `Other` reveals text field.
3. One tap → EventLog entry (`type: SYSTEM`).
4. Auto-creates OpenQuestion: "Confirm role of [System] in this process." `priority: important`.

**IMPLICIT → instant log:**
1. One tap → EventLog entry immediately (`type: IMPLICIT`, `label: null`).
2. Appears as `09:22  ● [unlabeled implicit]`.
3. Inline text field appears in the log entry for optional 2–3 word label. Auto-saves on blur. If left blank, addressed in debrief.

**QUESTION → instant log + optional label:**
1. One tap → EventLog entry immediately (`type: QUESTION`, `label: null`).
2. Appears as `09:25  ● [question]`.
3. Inline text field appears in the log entry. User types the question or doubt (e.g. "Why does she check two folders?" or "Ask about threshold"). Auto-saves on blur. Unlike IMPLICIT, leaving this blank is fine — it just means "I had a question about what just happened" and will be addressed in debrief.

**Suggestion generation:**
- API call on each STEP or EDGE tap. Sends: L1, session events so far, interview answers, focus area.
- **Latency target: 1.5s.** If slower, show text field immediately, animate chips in when ready.
- **Cache 30s** keyed by `session_id + event_count`. Reuse if no new events logged.

**Offline behavior:**
- Events stored in React state + queued for backend sync.
- "Offline" indicator in top-left if no network.
- Suggestions unavailable offline — text field only.
- Warning on page unload if unsynced events exist.

---

### 7.9 Post-Session Debrief (new screen — shadowing only)

**Purpose:** Bridge between capture and synthesis. Walks through QUESTION events and unlabeled IMPLICIT events to enrich the data before the AI processes it.

**When it appears:** Immediately after the user clicks "End Session" and confirms in the capture screen. The session status changes to `completed` and this screen appears.

**Layout:**

The debrief shows a sequential list of cards — one for each event that needs attention. Two categories:

**Category 1 — Questions logged during the session:**
Each QUESTION event becomes a card:

```
┌─────────────────────────────────────────────────────────┐
│  ● QUESTION  09:25                                      │
│  "Why does she check two folders?"                      │
│                                                         │
│  Context: Logged after STEP "Navigates to SharePoint"   │
│                                                         │
│  ○ Asked & answered                                     │
│    [Answer text field]                                  │
│                                                         │
│  ○ Still open → becomes an open question                │
│    Priority: [critical ▾]                               │
└─────────────────────────────────────────────────────────┘
```

- If "Asked & answered": user types the answer. This enriches the event log for synthesis.
- If "Still open": creates an OpenQuestion with the specified priority.

**Category 2 — Unlabeled IMPLICIT events:**
Each IMPLICIT event with `label: null` becomes a card:

```
┌─────────────────────────────────────────────────────────┐
│  ● IMPLICIT  09:16                                      │
│  [unlabeled]                                            │
│                                                         │
│  Context: Logged after STEP "Opens email from supplier" │
│                                                         │
│  What did you observe?                                  │
│  [Text field for description]                           │
│                                                         │
│  ○ I can describe it → [text field]                     │
│  ○ I'm not sure — keep as open question                 │
│    Priority: [critical ▾]                               │
└─────────────────────────────────────────────────────────┘
```

- If described: updates the EventLog label. Enriches synthesis.
- If "not sure": creates a `critical` OpenQuestion.

**Navigation:**
- Cards are shown in chronological order (as they occurred in the session).
- A progress indicator shows "3 of 7 items to review."
- User can skip any card (leaves it as-is for synthesis to handle).
- At the bottom: `Finish Debrief & View Session` button → navigates to Session Detail (7.10).

**Storage:** Debrief answers stored in `Session.debrief_answers` as JSONB:

```json
{
  "items": [
    {
      "event_log_id": "uuid",
      "type": "question",
      "resolution": "asked_answered",
      "answer": "She checks the Pending folder first, then Approved. It's a habit from when they used a different system.",
      "open_question_created": false
    },
    {
      "event_log_id": "uuid",
      "type": "implicit",
      "resolution": "described",
      "description": "She mentally maps the supplier to a geographic region to know which currency to expect.",
      "open_question_created": false
    },
    {
      "event_log_id": "uuid",
      "type": "implicit",
      "resolution": "open_question",
      "priority": "critical",
      "open_question_created": true,
      "open_question_id": "uuid"
    }
  ]
}
```

After the debrief, the session is fully enriched and ready for synthesis.

---

### 7.10 Session Detail

**Purpose:** View and interact with a single session. Content varies by status and type.

**Status: `planned`**
- Top: session metadata (type badge, date, contacts — editable). Interview answers displayed as Q&A pairs (read-only, "Re-do interview" link to repeat Step 3).
- Below: Prep brief (Section 7.7).
- Below: Transcript paste area.
- Actions: `Start Capture` (shadowing only). `Mark as completed` (non-shadowing — prompts to paste transcript first if empty).

**Status: `completed`**
- Session metadata (read-only).
- AI summary paragraph.
- Interview answers (Q&A pairs, read-only).
- Transcript (expandable).
- Event log (shadowing only — scrollable list).
- Debrief answers (shadowing only — summary of how questions and implicits were resolved).
- **Synthesis section:**
  - If not yet run: `Run Synthesis` button.
  - If complete: synthesis output panels (see below).
  - `Re-run Synthesis` button always available after first run.

**Synthesis output display:**

For **shadowing** — 4 collapsible panels:
1. **ProcessModel changes:** Diff view. New steps (green), modified (yellow), removed (strikethrough). `Apply changes` button (creates snapshot first, then merges).
2. **Edge Case Registry:** Table — description, frequency, handling, status dropdown, related step. Editable inline.
3. **Systems Map:** Table — name, confirmed toggle, role, details, gaps. Editable inline.
4. **Open Questions:** Table filtered to this synthesis. Each has "Add to process" button.

For **validation** — 1 panel:
1. **Corrections Log:** What changed, removed, added, who confirmed. `Apply corrections` button (snapshot + merge).

For **discovery / process_mapping / demo** — 3 panels:
1. **Session Summary:** Markdown. Topics, decisions, action items.
2. **Suggested ProcessModel updates:** List with checkboxes + "Apply selected."
3. **New Open Questions:** List with "Add to process" button.

**Important:** Nothing auto-applies. The user reviews and confirms each change.

---

### 7.11 AI Research Panel

**Purpose:** On-demand research assistant. Available from any screen.

**Implementation:** Slide-out from right (400px desktop, full-screen mobile). Opened by AI Research button (fixed bottom-right).

**Context:** Automatically includes L1 (matching process type), L2 (client data), and current page context (which client/process/session).

**UI:**
- Chat-style messages. User right, AI left.
- Text input at bottom. Enter to send, Shift+Enter for newline.
- AI responses as markdown with source links.
- Streaming responses (token by token).
- Conversation persists while panel is open. Navigating away clears it (confirmation if messages exist).
- Every exchange saved as ResearchNote in background.

**Scoped to FDE research only.** If user asks off-topic, redirects politely.

---

## 8. AI Features — Prompts & Output Schemas

### 8.1 Company Research (on Client Creation)

**Trigger:** Always on client creation (async, does not block UI).

**Prompt:**
```
System: You are a research assistant for a Forward Deployed Engineer at an AI automation company. Research a company and provide useful context for someone who will be automating their operational processes.

User: Research the company "{client.name}" in the {client.industry} industry.
{if website: "Their website is {client.website}."}

Provide:
1. A 2-3 sentence summary of what the company does, their size, and market position.
2. Their operational structure if findable — departments, key functions, supply chain.
3. Any information about their processes, systems, or pain points that would be relevant for operations automation.
4. Notable recent news or changes (acquisitions, expansions, restructuring).

Keep it factual and concise. Flag what you couldn't find.
```

**Tools:** Web search enabled.

**Output:** Plain text stored in `Client.ai_summary`. No structured schema.

**Error handling:** If fails, `ai_summary` = null. Show "Research unavailable — click to retry."

---

### 8.2 Process Hypothesis & Initial ProcessModel

**Trigger:** Process creation form saved. Synchronous, loading spinner, 30s timeout.

**Prompt:**
```
System: You are an expert process analyst. Generate an initial hypothesis for a client's operational process.

Client: {client.name}, industry: {client.industry}
Company summary: {client.ai_summary}
Process name: {process.name}
Department: {process.department_tag}
Description: {process.description}
Known systems: {known_systems}
Known pain points: {known_pain_points}

Domain knowledge:
{L1 JSON for matching process type}

Generate:
1. HYPOTHESIS: 3-5 sentence paragraph describing how this process likely works. Be specific but flag uncertainty.
2. INITIAL_STEPS: Ordered list of likely steps. For each: name (3-8 words), description (one sentence), likely systems, confidence always "inferred".

JSON response:
{
  "hypothesis": "string",
  "steps": [{ "name": "string", "description": "string", "systems": ["string"], "confidence": "inferred" }],
  "matched_process_type": "string"
}
```

**Output processing:** `hypothesis` → `Process.hypothesis_text`. `steps` → ProcessStep objects with auto IDs, sequential order, linear next_steps. `matched_process_type` → `Process.process_type_l1`.

---

### 8.3 Session Setup Interview

**Trigger:** User completes Step 2 (structured fields) of session creation and clicks "Continue."

**Implementation:** Multi-turn conversation. Each question is a separate API call. Maximum 3 turns.

**Prompt (first question):**
```
System: You are helping a Forward Deployed Engineer prepare for a {session.type} session. Ask focused questions to understand their goals and priorities for this session. You will ask 2-3 questions total (one at a time). Each question should be specific, not open-ended.

Context:
- Client: {client.name}, {client.industry}
- Process: {process.name} — {process.hypothesis_text}
- Process status: {process.status}
- Current ProcessModel: {steps with confidence}
- Open questions: {list}
- Previous session summaries: {list}
- Session type: {session.type}
- Contacts: {names and roles}
{type-specific fields already filled}

This is question 1 of 2-3. Ask one specific question about what the user wants to accomplish or focus on in this session. Base it on the process state — reference specific steps, gaps, or open questions when relevant.

Respond with ONLY the question text. No preamble.
```

**Prompt (subsequent questions):**
```
Previous questions and answers:
Q1: {question}
A1: {answer}
{Q2/A2 if exists}

This is question {n} of 2-3. Based on the answers so far, ask a follow-up that helps clarify priorities or surface something the user hasn't mentioned. If you have enough context after this answer, you may indicate that by ending your question with [LAST_QUESTION].

Respond with ONLY the question text.
```

**Output:** Each Q&A pair stored in `Session.interview_answers`.

---

### 8.4 Prep Brief Generation

**Trigger:** Session creation complete (after interview). Synchronous, 30s timeout.

**Prompt:**
```
System: Generate a prep brief for a Forward Deployed Engineer about to walk into a {session.type} session.

Context:
- Client: {client.name}, {client.industry}, {client.ai_summary}
- Process: {process.name} — {process.hypothesis_text}
- ProcessModel: {steps with confidence}
- Open questions: {list with priority}
- Previous session summaries: {list}
- Recent research notes: {last 3}
- Session type: {session.type}
- Contacts: {names and roles}
- Interview answers: {Q&A pairs from session setup}
{type-specific config}

Domain knowledge: {L1 JSON}

Generate three sections:

1. WHAT_WE_KNOW: Confirmed steps, systems, contacts, relevant research. Be specific.
2. WHATS_OPEN: Inferred/missing steps, unresolved questions, unconfirmed systems. Ordered by importance for this session based on the interview answers.
3. SUGGESTED_FOCUS: 5-10 specific actionable items tailored to the session type and the user's stated priorities from the interview. For shadowing: things to watch. For others: questions to ask.

JSON:
{
  "what_we_know": "markdown",
  "whats_open": "markdown",
  "suggested_focus": ["string", ...]
}
```

---

### 8.5 Capture Suggestions (Shadowing)

**Trigger:** STEP or EDGE button tap. Async, must return within 1.5s. `max_tokens: 200`.

**Prompt:**
```
System: Generate 4-5 suggestion chips for the next likely {STEP or EDGE} in this process. Each chip: 2-6 words, action description (verb + object).

Process type: {L1 process_type}
Typical steps: {L1 typical_steps, abbreviated}
Events so far: {EventLog entries}
Session focus: {interview_answers summary}
Button: {STEP or EDGE}

For EDGE: suggest exceptions/variations.

JSON array: ["suggestion", "suggestion", ...]
```

**Cache 30s** by `session_id + event_count`.

---

### 8.6 Follow-up Email Draft

**Trigger:** "Generate follow-up email" button.

**Prompt:**
```
System: Draft a professional follow-up email from an FDE to a client contact requesting clarification on open questions.

Client: {client.name}, Process: {process.name}
Contact: {primary contact}
Open questions: {checked questions with priority}
Recent session context: {last 2 summaries}

Write a warm, concise email (3 paragraphs max + question list). End with a clear next step.
Respond with email body only (markdown).
```

**Output:** Modal with rendered markdown. Copy-to-clipboard + edit toggle.

---

### 8.7 Post-Session Synthesis

**Trigger:** "Run Synthesis" button. Async with progress indicator. 30–60s expected. User can navigate away.

#### Shadowing synthesis:

**Inputs:** Event log + debrief answers + transcript + ProcessModel + L1 + L2.

**Prompt:**
```
System: Analyze a shadowing session. You have the event log, the user's debrief answers (where they clarified questions and implicit events), and optionally a transcript.

Client: {client}, Process: {process}
Interview answers (session goals): {interview_answers}
ProcessModel: {current steps, edge_cases, systems}
Domain knowledge: {L1}
Event log: {full log with types, labels, timestamps}
Debrief answers: {debrief_answers — includes clarifications for QUESTION and IMPLICIT events}
Transcript: {if available}

Generate:
1. SUMMARY: One paragraph session summary.
2. PROCESS_MODEL_UPDATES: Updated steps array. Mark confirmed (logged as STEP), keep inferred, mark missing if full flow observed and step was skipped. Include debrief clarifications as enriched detail.
3. EDGE_CASES: From EDGE + IMPLICIT events. Include frequency estimate, suggested handling, related step.
4. SYSTEMS: From SYSTEM events. Name, role, details, gaps.
5. OPEN_QUESTIONS: From unresolved debrief items, missing steps, unconfirmed systems, L1 gap patterns. With priority.

JSON:
{
  "summary": "string",
  "process_model_updates": { "steps": [...], "rationale": "string" },
  "edge_cases": [...],
  "systems": [...],
  "open_questions": [{ "text": "string", "priority": "critical|important|nice_to_have" }]
}
```

#### Non-shadowing synthesis:

```
System: Analyze a {session.type} session transcript.

{same context block}
Transcript/notes: {transcript_text}

Generate:
1. SUMMARY: Structured recap (markdown).
2. SUGGESTED_MODEL_UPDATES: Changes to suggest to the ProcessModel.
3. NEW_QUESTIONS: With priority.
4. DISCOVERED_ENTITIES: New contacts or systems mentioned.

JSON:
{
  "summary": "markdown",
  "suggested_model_updates": [{ "type": "add_step|modify_step|add_system|add_edge_case", "detail": {}, "rationale": "string" }],
  "new_questions": [{ "text": "string", "priority": "string" }],
  "discovered_entities": { "contacts": [...], "systems": [...] }
}
```

---

### 8.8 AI Research Panel

**System prompt:**
```
You are a research assistant for a Forward Deployed Engineer at Traza AI. Help them research and understand client companies, industry patterns, operational processes, and system documentation.

Current context:
{L1 for matching process type}
{L2: client summary, industry, systems, contacts, process status, recent sessions}

Stay focused on FDE research. Be specific and actionable. Flag information that contradicts the current ProcessModel. Keep responses to 1-3 paragraphs unless asked for depth.
```

**Tools:** Web search enabled. Streaming responses.

**Storage:** Each exchange → ResearchNote.

---

## 9. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| AI API call fails (timeout, 500, rate limit) | Inline error + retry button. Never block non-AI features. Capture suggestions: skip, show text field only. |
| AI returns malformed JSON | Log error. "AI response could not be processed — try again" + retry. Store raw response in error log. |
| Session ended with 0 events | Allow. Synthesis available but produces minimal output. |
| Process creation with empty description | Allow. Hypothesis based solely on name + L1. May be generic. |
| Company research — nothing found | Set `ai_summary` to "Limited information found for [company]. Use the Research panel for more specific queries." |
| Synthesis on session with no transcript and no events | Warning: "No session data to analyze." Disable synthesis button. |
| Network loss during shadowing | Events queue in React state. "Offline" indicator. Sync on reconnect. Warning on page unload if unsynced. |
| Concurrent edits (Phase 1: single admin) | Not a concern. Phase 3: optimistic locking on ProcessModel. |
| Artifact > 50MB | Error: "File too large. Maximum: 50MB." |
| Interview API call fails mid-interview | Show error + "Skip interview" button. Session created with whatever answers were collected. |
| Debrief skipped (user navigates away) | Session still marked completed. Debrief answers empty. Synthesis uses raw event log without enrichment. |

---

## 10. Integrations

| Integration | Phase | How | Notes |
|---|---|---|---|
| Granola | 1 | Manual paste | Textarea on Session Detail. No API. All session types. |
| Excalidraw export | 2 | `.excalidraw` JSON from ProcessModel | Rectangles (steps), diamonds (decisions), orange (edges), red (missing). |
| L1 Domain Library editor | 2 | Admin UI for editing L1 JSONs | Founders can update without code changes. |
| Capture email | 3 | Postmark inbound webhook | Per-process address. Requires DNS. |
| Gmail OAuth | 3 | Pull artifacts from Gmail | OAuth2 via Clerk. |

---

## 11. Tech Stack & Infrastructure

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui | Client components for capture, research panel, interview. |
| Backend | FastAPI (Python) | API layer. AI prompt construction + response parsing. |
| Database | Supabase (PostgreSQL) | RLS on all tables. JSONB for ProcessModel, prep_brief, synthesis_output, interview_answers, debrief_answers. |
| Auth | Clerk | Single org. Role in user metadata → Supabase JWT claim. |
| AI | Claude API (claude-sonnet-4-20250514) | Direct API calls from FastAPI. No LangChain in Phase 1. |
| File storage | Supabase Storage | `artifacts/` bucket with RLS. |
| Deployment | Railway | Two services: frontend + backend. Single Supabase project. |

### API structure

```
POST   /api/clients                        — create client (triggers research)
GET    /api/clients                        — list (with filters)
GET    /api/clients/{id}                   — detail with contacts + process summaries
PATCH  /api/clients/{id}                   — update
DELETE /api/clients/{id}                   — soft delete

POST   /api/clients/{id}/contacts          — create contact
PATCH  /api/contacts/{id}                  — update
DELETE /api/contacts/{id}                  — soft delete

POST   /api/clients/{id}/processes         — create (triggers hypothesis)
GET    /api/processes/{id}                 — detail with model, sessions, questions
PATCH  /api/processes/{id}                 — update

GET    /api/processes/{id}/model           — get ProcessModel
POST   /api/processes/{id}/model/apply     — apply changes (snapshot + merge)

POST   /api/processes/{id}/sessions        — create session
GET    /api/sessions/{id}                  — detail
PATCH  /api/sessions/{id}                  — update (transcript, status, etc.)

POST   /api/sessions/{id}/interview        — get next interview question (streaming)
POST   /api/sessions/{id}/events           — log event (capture)
GET    /api/sessions/{id}/events           — get event log
POST   /api/sessions/{id}/debrief          — save debrief answers
POST   /api/sessions/{id}/synthesize       — trigger synthesis (async)
GET    /api/sessions/{id}/synthesis        — get results

POST   /api/processes/{id}/artifacts       — upload
GET    /api/processes/{id}/artifacts       — list
PATCH  /api/artifacts/{id}                 — update metadata

GET    /api/processes/{id}/questions       — list
POST   /api/processes/{id}/questions       — create manually
PATCH  /api/questions/{id}                 — update (resolve, priority)

POST   /api/processes/{id}/email-draft     — generate follow-up email
POST   /api/research                       — research query (streaming)

POST   /api/ai/company-research            — trigger company research
POST   /api/ai/suggestions                — capture suggestions (low-latency)

GET    /api/domain-library                 — get L1 process types (internal use)
```

All endpoints require Clerk auth. Write endpoints return 403 for `viewer` role.

---

## 12. Build Phases

### Phase 1 — Capture & Synthesize (4 weeks)

**Week 1:** DB schema + auth + client CRUD + contact CRUD + company research (AI). Seed L1 JSONs.
**Week 2:** Process CRUD + hypothesis generation. ProcessModel display (inline flow). Session creation (type selector + form + AI interview) + prep brief.
**Week 3:** Shadowing capture (5-button logger + suggestions + offline). Post-session debrief. Transcript paste for all types.
**Week 4:** Synthesis (all session types). Open questions. Follow-up email. AI Research panel. Artifact upload. Polish + deploy.

**Gate:** 2+ real shadowing sessions + 1+ non-shadowing. Evaluate: prep brief useful? Capture suggestions accurate? Debrief flow natural? Synthesis output usable?

### Phase 2 — Intelligence & Polish (3 weeks)

- Artifact AI pre-labeling
- AI chat for process creation (alternative to form)
- Excalidraw export
- Domain Library editor (L1)
- Eval dataset export
- Refinements from Phase 1 feedback

### Phase 3 — Automation & Scale (3+ weeks)

- Capture email (Postmark)
- Gmail OAuth
- Specialized capture UIs for non-shadowing types
- Analytics
- POC builder
- Client-facing validation portal

---

## 13. Open Questions

| # | Question | Blocking | Proposed Resolution |
|---|---|---|---|
| 1 | L1 seeding: Alberto writes 3 process type JSONs. | Phase 1, Week 1 | 2–3 days. Use schema in Section 3. |
| 2 | Founder permissions: read-only acceptable? | Phase 1 | Confirm with founders. |
| 3 | Tablet testing: capture UI on iPad. | Phase 1, Week 3 | Test on real iPad. Adjust button sizes. Five buttons need to fit comfortably. |
| 4 | Claude API costs: ~$5–15/engagement estimated. | Phase 1 | Monitor first month. |
| 5 | Offline capture: browser memory only acceptable? | Phase 1 | Yes for Phase 1. Add IndexedDB in Phase 2. |
| 6 | Interview flow: 2 or 3 questions optimal? | Phase 1, Week 2 | Start with max 3. Reduce based on user feedback. |
| 7 | Debrief: should it be mandatory or skippable? | Phase 1, Week 3 | Skippable — user can go directly to Session Detail. But show a badge: "5 items to review." |
| 8 | Excalidraw format. | Phase 2 | Validate before building. |
| 9 | Capture email DNS. | Phase 3 | Not blocking. |