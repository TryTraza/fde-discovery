# Phase 4 — Session Lifecycle (Non-Shadowing) — Implementation Plan v6

## Review Summary

This is a full rewrite of v5. The v5 plan had **12 confirmed or likely schema mismatches** between its assumptions and what Phase 1 actually built. A junior developer following v5 would write code against wrong column names, then discover conflicts at Step 0 pre-flight and not know which snippets to fix — because every code sample in the plan hardcodes the wrong names.

### Changes from v5 (tagged `🔧 FIX` / `🆕 ADD`)

1. **🔧 FIX: `transcript` → likely `transcriptText`**. The v2 spec schema test explicitly checks `transcriptText`, and the Drizzle column is `text('transcript_text')`. The plan v5 used `transcript` everywhere. Fixed: all references now use a **placeholder constant** `COL_TRANSCRIPT` with instructions to resolve at Step 0. Same for all disputed columns.
2. **🔧 FIX: `synthesisResult` → likely `synthesisOutput`**. The v2 spec uses `synthesisOutput` and `synthesis_output`. Fixed.
3. **🔧 FIX: `stepConfidence` includes `'missing'` not `'gap'`**. The original spec says `confirmed / inferred / missing`. Fixed in synthesis Zod schema.
4. **🔧 FIX: `processModels` may lack `version` column**. The v2 schema definition has NO version column but the Phase 1 prompt included one. Step 0 now handles both cases explicitly.
5. **🔧 FIX: `processModelSnapshots` column names conflict**. Two specs exist: one with `trigger`/`state`, another with `snapshotData`/`version`/`changeDescription`. Step 0 now resolves this.
6. **🔧 FIX: `sessionContacts` may have `roleInSession` column**. Original spec includes `role_in_session text`. Plan must handle its existence.
7. **🔧 FIX: Session `date` is `date` type not `timestamp`**. Using `new Date()` on a Drizzle `date()` column may store time components incorrectly. Fixed: use date string directly for date columns.
8. **🔧 FIX: SystemEntry JSONB has `details`/`gaps` fields, not `detailNotes`/`role`**. Synthesis schema and merge functions updated.
9. **🔧 FIX: EdgeCase JSONB has `status` and `related_step_id` fields**. Merge function must preserve these.
10. **🔧 FIX: `sessions.notes` column exists in v2 spec**. Step 0 no longer needs to add it.
11. **🆕 ADD: Explicit column name resolution table in Step 0**. Instead of "verify at runtime", the plan now has a binding table where the developer fills in actual names ONCE and all subsequent steps reference that table.
12. **🆕 ADD: `snapshotTriggerEnum`**. The processModelSnapshots table uses an enum for the trigger column. Step 8 must use a valid enum value (`synthesis_apply`), not free text.

---

## Context

Phase 3 (Process CRUD + Hypothesis) is complete with 157 tests passing. Phase 4 adds session management: creation with type-specific fields, AI interview prep, transcript+notes capture with auto-save, AI synthesis, and synthesis review/apply. Sessions are the core data-gathering unit — every discovery call, process mapping workshop, validation meeting, and demo is a session tied to a process.

---

## Step 0 — Schema Audit + Query Functions (Required Before Any Other Step)

**Goal**: Resolve ALL schema ambiguities, add missing query functions, and configure AI tiers. Every subsequent step references the binding table produced here. No code in Steps 1-8 should contain column name guesses.

### Pre-flight Check

Run these commands and record the output:

```bash
# 1. Sessions table — full column list
grep -A 60 'sessions = pgTable' src/lib/db/schema.ts

# 2. SessionContacts table — check for roleInSession column
grep -A 20 'sessionContacts = pgTable' src/lib/db/schema.ts

# 3. ProcessModelSnapshots table — full column list
grep -A 20 'processModelSnapshots = pgTable' src/lib/db/schema.ts

# 4. ProcessModels table — check for version column
grep -A 30 'processModels = pgTable' src/lib/db/schema.ts

# 5. Existing session query functions
grep -n 'export.*function\|export.*async' src/lib/db/queries/sessions.ts 2>/dev/null || echo "FILE NOT FOUND"

# 6. Existing process query functions
grep -n 'export.*function\|export.*async' src/lib/db/queries/processes.ts

# 7. Existing processModel query functions
grep -n 'export.*function\|export.*async' src/lib/db/queries/process-models.ts 2>/dev/null || echo "FILE NOT FOUND"

# 8. Existing openQuestion query functions
grep -n 'export.*function\|export.*async' src/lib/db/queries/open-questions.ts 2>/dev/null || echo "FILE NOT FOUND"

# 9. Check getAIConfig supported tiers
grep -n 'interview\|synthesis\|hypothesis' src/lib/ai/get-ai-config.ts

# 10. Existing contacts hook
grep -rn 'useContacts\|export.*function.*useContacts' src/lib/hooks/ 2>/dev/null || echo "HOOK NOT FOUND"

# 11. Contacts query functions (need getContactsByIds)
grep -n 'export.*function\|export.*async' src/lib/db/queries/contacts.ts 2>/dev/null || echo "FILE NOT FOUND"

# 12. Where handleAPIError and parseJSON live
grep -rn 'export.*handleAPIError' src/lib/ 2>/dev/null
grep -rn 'export.*parseJSON' src/lib/ 2>/dev/null

# 13. Open questions table — full column list
grep -A 30 'openQuestions = pgTable' src/lib/db/schema.ts

# 14. Processes table — hypothesisText column name
grep -n 'hypothesisText\|hypothesis_text\|hypothesis' src/lib/db/schema.ts

# 15. SWR global configuration
grep -rn 'SWRConfig\|fetcher' src/app/layout.tsx src/app/providers.tsx src/lib/swr* 2>/dev/null || echo "NO SWR CONFIG FOUND"

# 16. Shared Session types
grep -rn 'InferSelectModel.*sessions\|type Session' src/lib/db/types.ts 2>/dev/null || echo "NO SESSION TYPE FOUND"

# 17. Auth function names and signatures
grep -n 'export.*function.*require\|export.*async.*function.*require' src/lib/auth/utils.ts

# 18. Session type and status enum values
grep -A 10 'sessionType\|sessionStatus' src/lib/db/schema.ts | head -30

# 19. stepConfidence enum values
grep -A 5 'stepConfidence' src/lib/db/schema.ts

# 20. edgeCaseFrequency enum values
grep -A 5 'edgeCaseFrequency' src/lib/db/schema.ts

# 21. snapshotTriggerEnum values
grep -A 5 'snapshotTrigger' src/lib/db/schema.ts

# 22. Check for title and durationMinutes on sessions
grep -n 'title\|durationMinutes\|duration_minutes' src/lib/db/schema.ts | head -10

# 23. Check date column type on sessions
grep -n "date(" src/lib/db/schema.ts | head -5
```

### 🆕 Binding Table — Column Name Resolution

After running the pre-flight checks, fill in this table. **ALL subsequent steps reference these bindings. Never hardcode column names — use the binding.**

| Binding Key | Expected (from spec conflicts) | Actual (from grep) | Notes |
|-------------|-------------------------------|-------------------|-------|
| `SESSION_TRANSCRIPT_COL` | `transcriptText` OR `transcript` | _______ | v2 spec used `transcriptText`; v5 plan used `transcript` |
| `SESSION_NOTES_COL` | `notes` | _______ | v2 spec had it; if missing, add it |
| `SESSION_SYNTHESIS_COL` | `synthesisOutput` OR `synthesisResult` | _______ | v2 spec used `synthesisOutput`; v5 plan used `synthesisResult` |
| `SESSION_TITLE_COL` | `title` | _______ | Should exist per both specs |
| `SESSION_DATE_COL` | `date` | _______ | Confirm `date()` type, not `timestamp()` |
| `SESSION_DATE_TYPE` | `date` or `timestamp` | _______ | Critical for how we pass values |
| `SESSION_DURATION_COL` | `durationMinutes` | _______ | May be missing |
| `SESSION_PREP_BRIEF_COL` | `prepBrief` | _______ | JSONB |
| `SESSION_INTERVIEW_ANSWERS_COL` | `interviewAnswers` | _______ | JSONB |
| `PROCESS_MODEL_VERSION_COL` | `version` (may not exist) | _______ | If missing, skip version bumping |
| `SNAPSHOT_DATA_COL` | `state` OR `snapshotData` | _______ | v2 spec used `state`; v5 plan used `snapshotData` |
| `SNAPSHOT_TRIGGER_COL` | `trigger` (enum) | _______ | v2 spec used enum; v5 plan used free text `changeDescription` |
| `SNAPSHOT_TRIGGER_VALUES` | `synthesis_apply \| validation_merge` | _______ | Record actual enum values |
| `SNAPSHOT_VERSION_COL` | `version` (may not exist) | _______ | Only in one spec variant |
| `SNAPSHOT_CHANGE_DESC_COL` | `changeDescription` (may not exist) | _______ | Only in one spec variant |
| `SNAPSHOT_SESSION_ID_NULLABLE` | Should be nullable | _______ | Phase 3 snapshots have no session |
| `SESSION_CONTACTS_ROLE_COL` | `roleInSession` (may exist) | _______ | Original spec included it |
| `OPEN_QUESTION_TEXT_COL` | `question` | _______ | Confirm column name |
| `STEP_CONFIDENCE_VALUES` | `confirmed \| inferred \| missing` | _______ | Original spec uses `missing`, NOT `gap` |
| `EDGE_CASE_FREQUENCY_VALUES` | `rare \| occasional \| frequent \| unknown` | _______ | Confirm |
| `AUTH_READ_FN` | `requireUserId` or `requireAuth` | _______ | Name + return shape |
| `AUTH_WRITE_FN` | `requireAdmin` | _______ | Name + return shape (does it return `{ userId }`?) |
| `HANDLE_API_ERROR_PATH` | Unknown | _______ | Record actual import path |
| `PARSE_JSON_PATH` | Unknown | _______ | Record actual import path |
| `SYSTEM_ENTRY_DETAIL_FIELD` | `details` (original spec) or `detailNotes` (v2) | _______ | Check JSONB structure in processModels |
| `SYSTEM_ENTRY_GAPS_FIELD` | `gaps` (may exist) | _______ | Original spec had it |
| `EDGE_CASE_STATUS_FIELD` | `status` with `open \| needs_clarification \| resolved` | _______ | Original spec had it |

**CRITICAL INSTRUCTION**: Once this table is filled, create a comment block at the top of the FIRST file you create (the validation schemas) documenting all resolved bindings. Every subsequent file references this comment, not the plan's default names.

### Decision Matrix — Schema Changes Needed

| Check | If Missing | Action |
|-------|-----------|--------|
| `notes` column on sessions table | Add `notes: text('notes')` | Unlikely needed — v2 spec included it |
| `durationMinutes` column on sessions | Add it | Check prompt #3 spec — it was included |
| `version` column on processModels | **Do NOT add in Phase 4** — track version via snapshot count instead | See Step 8 alternative |
| `processModelSnapshots` table | Must exist from Phase 1. If missing, STOP | Blocker |
| `hypothesisText` column on processes | Must exist from Phase 3. If missing, STOP | Blocker |

### Decision Matrix — Version Column on processModels

The two spec variants disagree on whether `processModels` has a `version` column:
- Phase 1 prompt #3 included `version (int)`
- v2 schema definition did NOT include `version`

| If `version` column... | Action for Phase 4 |
|------------------------|-------------------|
| EXISTS | Use it — bump on each apply. Step 8 increments version. |
| DOES NOT EXIST | **Option A (preferred)**: Add `version: integer('version').default(1).notNull()` to processModels in schema.ts, run `db:push`. **Option B**: Skip version tracking entirely — snapshots already provide history. In this case, remove all `version` references from Step 8 and return `{ success: true }` instead of `{ success: true, newVersion }`. |

Record decision: _______ (EXISTS / ADD / SKIP)

### Decision Matrix — processModelSnapshots Column Names

| If columns are... | Action |
|-------------------|--------|
| `trigger` (enum) + `state` (jsonb) + NO `version`/`changeDescription` | Use `trigger: 'synthesis_apply'` and `state: { steps, systems, edgeCases }` in Step 8 |
| `snapshotData` + `version` + `changeDescription` (no `trigger` enum) | Use those column names in Step 8 |
| Something else | Adapt Step 8 to match |

### Decision Matrix — Auth Functions

| Expected Name | If Different |
|--------------|--------------|
| `requireAdmin()` returns `{ userId: string }` | Use actual name and destructure pattern everywhere |
| `requireUserId()` or `requireAuth()` for reads | Use actual name |

### Decision Matrix — SWR Configuration

| If... | Action |
|-------|--------|
| Global SWR fetcher exists | Use `useSWR` as-is |
| NO global SWR fetcher | **MUST add one in Step 2** — without it, all SWR hooks silently return `undefined` |

### Decision Matrix — AI Config Tiers

| Tier | Used By | If Missing |
|------|---------|-----------|
| `'interview'` | Steps 4, 6 | Add to `getAIConfig` switch — map to Haiku |
| `'synthesis'` | Step 7 | Add to `getAIConfig` switch — map to Sonnet |

### Query Functions to Create (if missing)

Record which ALREADY EXIST. Create any that don't:

| Function | File | Implementation |
|----------|------|----------------|
| `softDeleteSession(id)` | `sessions.ts` | Set `deletedAt`, return deleted row or null |
| `getSessionById(id)` | `sessions.ts` | Select where `id = X AND deletedAt IS NULL` |
| `listSessionsByProcess(processId)` | `sessions.ts` | **Lean select** — id, title, type, date, status, durationMinutes, createdBy, createdAt only. Do NOT return transcript/notes/synthesis/prepBrief (large fields waste bandwidth in list view) |
| `getSessionWithContacts(id)` | `sessions.ts` | Session + join sessionContacts → contacts |
| `updateSession(id, data)` | `sessions.ts` | Partial update, no Zod validation (route validates, internal callers bypass) |
| `getCompletedSessionsByProcess(processId)` | `sessions.ts` | Where status IN ('completed', 'synthesis_done') AND deletedAt IS NULL |
| `getContactsByIds(ids)` | `contacts.ts` | Where id IN (...) AND deletedAt IS NULL |
| `getProcessWithModel(processId)` | `processes.ts` | Process + latest processModel (or null) |
| `createProcessModel(data)` | `process-models.ts` | Insert into processModels |
| `updateProcessModel(id, data)` | `process-models.ts` | Partial update |
| `createOpenQuestion(data)` | `open-questions.ts` | Insert into openQuestions |

**⚠️ Transaction note**: Step 8's apply route runs all mutations inside `db.transaction()`. Query functions use the global `db` instance, which bypasses the transaction. **Step 8 will use raw `tx.insert()` / `tx.update()` calls directly** inside the transaction. Query functions above are for non-transactional reads.

### Implementation Snippets

All snippets below use placeholder column names. **Replace with actual names from the binding table.**

#### `softDeleteSession`

```typescript
export async function softDeleteSession(id: string) {
  const [deleted] = await db
    .update(sessions)
    .set({ deletedAt: new Date() })
    .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
    .returning();
  return deleted ?? null;
}
```

#### `listSessionsByProcess` (Lean)

```typescript
export async function listSessionsByProcess(processId: string) {
  return db
    .select({
      id: sessions.id,
      processId: sessions.processId,
      type: sessions.type,
      title: sessions.title, // BINDING: SESSION_TITLE_COL
      date: sessions.date,   // BINDING: SESSION_DATE_COL
      status: sessions.status,
      durationMinutes: sessions.durationMinutes, // BINDING: SESSION_DURATION_COL — omit if column doesn't exist
      createdBy: sessions.createdBy,
      createdAt: sessions.createdAt,
      // NOTE: Deliberately excludes transcript, notes, synthesis, prepBrief
    })
    .from(sessions)
    .where(and(eq(sessions.processId, processId), isNull(sessions.deletedAt)))
    .orderBy(desc(sessions.date));
}
```

#### `getSessionWithContacts`

```typescript
export async function getSessionWithContacts(id: string) {
  const session = await getSessionById(id);
  if (!session) return null;

  // BINDING: Verify sessionContacts column names (sessionId, contactId)
  const contactRows = await db
    .select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(eq(sessionContacts.sessionId, id));

  return {
    ...session,
    contacts: contactRows.map((r) => r.contact),
  };
}
```

#### `getCompletedSessionsByProcess`

```typescript
export async function getCompletedSessionsByProcess(processId: string) {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.processId, processId),
        inArray(sessions.status, ['completed', 'synthesis_done']),
        isNull(sessions.deletedAt)
      )
    )
    .orderBy(sessions.date);
}
```

#### `getContactsByIds`

```typescript
export async function getContactsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(contacts)
    .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)));
}
```

#### `getProcessWithModel`

```typescript
export async function getProcessWithModel(processId: string) {
  const process = await getProcessById(processId);
  if (!process) return null;

  const [model] = await db
    .select()
    .from(processModels)
    .where(eq(processModels.processId, processId))
    .limit(1);
  // Note: processModels has unique constraint on processId, so limit(1) is sufficient.
  // No orderBy needed — there can only be one.

  return { ...process, model: model ?? null };
}
```

**IMPORTANT**: Verify the return shape. The rest of the plan assumes `{ ...process, model: { id, steps, systems, edgeCases, ... } | null }` AND that `process.hypothesisText` is accessible. Document the actual shape.

#### `updateSession` — Internal vs API Validation

```typescript
// BINDING: Replace all column references with actual names from binding table
export async function updateSession(
  id: string,
  data: Partial<{
    title: string;
    date: string | Date;  // BINDING: depends on SESSION_DATE_TYPE
    status: string;
    transcriptText: string | null;  // BINDING: SESSION_TRANSCRIPT_COL
    notes: string | null;           // BINDING: SESSION_NOTES_COL
    durationMinutes: number | null; // BINDING: SESSION_DURATION_COL
    prepBrief: any;                 // Used by Step 6 (internal, not Zod-validated)
    synthesisOutput: any;           // BINDING: SESSION_SYNTHESIS_COL — used by Step 7
    interviewAnswers: any;          // BINDING: SESSION_INTERVIEW_ANSWERS_COL
  }>
) {
  const [updated] = await db
    .update(sessions)
    .set({ ...data, updatedAt: new Date() }) // Remove updatedAt if column doesn't exist
    .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
    .returning();
  return updated ?? null;
}
```

### After Step 0

```bash
npm run db:push   # Apply schema to Supabase (if schema changed)
npx vitest run    # Verify all existing 157 tests still pass
npm run build     # Verify no TypeScript errors
```

### Tests

None. This is infrastructure verified by `db:push` succeeding, existing tests passing, and `npm run build` clean.

---

## Step Ordering

```
Step 0: Schema audit + query functions + AI config ───┐
Step 1: Session CRUD API routes                        │
Step 2: SWR hooks + Sessions list in process view      │
Step 3: Session creation dialog (type + fields)        │
Step 4: AI interview route + interview UI step         │
Step 5: Session detail page (transcript + notes)       │
Step 6: Prep brief generation (AI route + card)        │
Step 7: Non-shadowing synthesis (AI route)             │
Step 8: Synthesis display + apply                      │
```

---

## Step 1 — Session CRUD API Routes

**Goal**: Complete REST API for sessions with test-first approach.

### Files to CREATE

- `src/lib/validations/session.ts` — Zod schemas
- `src/app/api/sessions/route.ts` — GET (list), POST (create)
- `src/app/api/sessions/[sessionId]/route.ts` — GET (detail), PATCH, DELETE
- `src/__tests__/api/sessions.test.ts` — list + create tests
- `src/__tests__/api/sessions-id.test.ts` — detail + update + delete tests

### API Signatures

**BINDING**: Replace `AUTH_READ_FN` and `AUTH_WRITE_FN` with actual function names from Step 0.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/sessions?processId=X` | AUTH_READ_FN | Lean list |
| POST | `/api/sessions` | AUTH_WRITE_FN | Create session + contacts |
| GET | `/api/sessions/[sessionId]` | AUTH_READ_FN | Full detail + contacts |
| PATCH | `/api/sessions/[sessionId]` | AUTH_WRITE_FN | Partial update |
| DELETE | `/api/sessions/[sessionId]` | AUTH_WRITE_FN | Soft delete |

### Validation Schemas (`src/lib/validations/session.ts`)

```typescript
import { z } from 'zod';

// BINDING: These enum values MUST match src/lib/db/schema.ts exactly.
// Verify from pre-flight check #18.
export const sessionTypeEnum = z.enum([
  'stakeholder_interview',
  'process_walkthrough',
  'shadowing',
  'document_review',
  'system_demo',
]);

export const sessionStatusEnum = z.enum([
  'planned',
  'in_progress',
  'completed',
  'synthesis_done',
]);

// 🔧 FIX: Validate date string — handles both date-only and ISO datetime strings
const dateString = z.string().refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: 'Invalid date string' }
);

export const createSessionSchema = z.object({
  processId: z.string().uuid(),
  type: sessionTypeEnum,
  title: z.string().min(1).max(200),
  date: dateString,
  contactIds: z
    .array(z.string().uuid())
    .optional()
    .default([])
    .transform((ids) => [...new Set(ids)]), // Deduplicate
  interviewAnswers: z
    .object({
      questions: z.array(
        z.object({ question: z.string(), answer: z.string() })
      ),
    })
    .optional(),
});

// NOTE: This schema is ONLY for the PATCH API route.
// Internal callers (Steps 6, 7) call updateSession() directly without Zod.
// Do NOT add prepBrief or synthesisOutput here.
export const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  date: dateString.optional(),
  status: sessionStatusEnum.optional(),
  // BINDING: Use actual column names from binding table
  transcriptText: z.string().nullable().optional(), // BINDING: SESSION_TRANSCRIPT_COL
  notes: z.string().nullable().optional(),           // BINDING: SESSION_NOTES_COL
  durationMinutes: z.number().int().positive().nullable().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
```

### Route Implementation — GET List

```typescript
// src/app/api/sessions/route.ts
import { NextResponse } from 'next/server';
import { createSessionSchema } from '@/lib/validations/session';
import { listSessionsByProcess } from '@/lib/db/queries/sessions';
import { getProcessById } from '@/lib/db/queries/processes';
import { getContactsByIds } from '@/lib/db/queries/contacts';
import { db } from '@/lib/db';
import { sessions, sessionContacts } from '@/lib/db/schema';
// BINDING: Replace with actual paths from Step 0
import { parseJSON, handleAPIError } from 'PARSE_JSON_PATH / HANDLE_API_ERROR_PATH';
import { AUTH_READ_FN, AUTH_WRITE_FN } from '@/lib/auth/utils';

export async function GET(request: Request) {
  try {
    await AUTH_READ_FN();
    const { searchParams } = new URL(request.url);
    const processId = searchParams.get('processId');

    if (!processId) {
      return NextResponse.json(
        { error: 'processId query parameter is required' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(processId)) {
      return NextResponse.json(
        { error: 'processId must be a valid UUID' },
        { status: 400 }
      );
    }

    const sessionsList = await listSessionsByProcess(processId);
    return NextResponse.json(sessionsList);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### Route Implementation — POST

```typescript
// (continuation of src/app/api/sessions/route.ts)
export async function POST(request: Request) {
  try {
    const { userId } = await AUTH_WRITE_FN();
    const body = await parseJSON(request, createSessionSchema);

    // Validate process exists
    const process = await getProcessById(body.processId);
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 400 });
    }

    // Validate contactIds (already deduplicated by Zod)
    if (body.contactIds && body.contactIds.length > 0) {
      const existingContacts = await getContactsByIds(body.contactIds);
      if (existingContacts.length !== body.contactIds.length) {
        return NextResponse.json(
          { error: 'One or more contactIds are invalid' },
          { status: 400 }
        );
      }
    }

    // 🔧 FIX: Handle date type correctly.
    // BINDING: If SESSION_DATE_TYPE is 'date', pass the date string directly
    // (Drizzle date() columns expect 'YYYY-MM-DD' strings).
    // If SESSION_DATE_TYPE is 'timestamp', pass new Date(body.date).
    const dateValue = body.date; // Adjust based on binding

    const session = await db.transaction(async (tx) => {
      const [newSession] = await tx
        .insert(sessions)
        .values({
          processId: body.processId,
          type: body.type,
          title: body.title,
          date: dateValue,
          status: 'planned',
          createdBy: userId,
          interviewAnswers: body.interviewAnswers ?? null,
        })
        .returning();

      if (body.contactIds && body.contactIds.length > 0) {
        await tx.insert(sessionContacts).values(
          body.contactIds.map((contactId) => ({
            sessionId: newSession.id,
            contactId,
            // BINDING: If SESSION_CONTACTS_ROLE_COL exists, set to null or a default
          }))
        );
      }

      return newSession;
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### Route Implementation — Detail GET/PATCH/DELETE

```typescript
// src/app/api/sessions/[sessionId]/route.ts
import { NextResponse } from 'next/server';
import { updateSessionSchema } from '@/lib/validations/session';
import {
  getSessionById,
  getSessionWithContacts,
  updateSession,
  softDeleteSession,
} from '@/lib/db/queries/sessions';
// BINDING: Replace with actual paths
import { parseJSON, handleAPIError } from 'ACTUAL_PATH';
import { AUTH_READ_FN, AUTH_WRITE_FN } from '@/lib/auth/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await AUTH_READ_FN();
    const { sessionId } = await params;

    const session = await getSessionWithContacts(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await AUTH_WRITE_FN();
    const { sessionId } = await params;
    const body = await parseJSON(request, updateSessionSchema);

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 🔧 FIX: Handle date type based on binding
    // BINDING: If SESSION_DATE_TYPE is 'date', keep as string.
    // If 'timestamp', convert: updateData.date = new Date(body.date)
    const updateData: Record<string, unknown> = { ...body };

    const updated = await updateSession(sessionId, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await AUTH_WRITE_FN();
    const { sessionId } = await params;

    const deleted = await softDeleteSession(sessionId);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### Key Decisions

- Flat routes (`/api/sessions/...`) — session ID is globally unique.
- POST creates session + session_contacts atomically in `db.transaction()`.
- POST validates contactIds exist BEFORE the transaction.
- `contactIds` deduplicated via Zod `.transform()`.
- `date` validated via `.refine()` to reject unparseable strings.
- GET list returns lean session objects (no transcript/notes/synthesis/prepBrief).
- GET detail returns session + contacts via `getSessionWithContacts`.
- `createdBy` set server-side from auth — never from client input.
- `updateSessionSchema` only covers API-exposed fields. Internal callers (Steps 6, 7) bypass Zod.

### Tests (~26)

- Auth: 401 unauthenticated for GET list, POST, PATCH, DELETE
- Auth: 403 non-admin for POST, PATCH, DELETE
- Validation: 400 missing `processId` on GET list
- Validation: 400 invalid UUID format for `processId` on GET list
- Validation: 400 missing required fields on POST
- Validation: 400 invalid `processId` (nonexistent process) on POST
- Validation: 400 invalid enum value for `type` on POST
- Validation: 400 invalid `contactIds` on POST
- Validation: 400 invalid date string on POST
- Validation: POST with duplicate `contactIds` deduplicates successfully
- 404: nonexistent session for GET detail, PATCH, DELETE
- 404: soft-deleted session returns 404 for GET detail
- Happy: POST creates session with no contacts, returns 201 with `createdBy`
- Happy: POST with `contactIds` creates session + session_contacts, returns 201
- Happy: POST with `interviewAnswers` stores JSONB correctly
- Happy: GET list returns sessions for process (empty array if none)
- Happy: GET list does NOT return other processes' sessions
- Happy: GET list does NOT return soft-deleted sessions
- Happy: GET list does NOT include transcript/notes/synthesis/prepBrief fields
- Happy: GET detail returns session + contacts array (includes full fields)
- Happy: PATCH updates transcript (BINDING: SESSION_TRANSCRIPT_COL)
- Happy: PATCH updates notes
- Happy: PATCH updates status
- Happy: PATCH updates date
- Happy: PATCH with empty body returns 200 unchanged
- Happy: DELETE soft-deletes, subsequent GET returns 404

### Reuse

- Follow exact pattern from existing routes (e.g., `src/app/api/clients/route.ts`)
- `parseJSON`, `handleAPIError` from paths found in Step 0
- Auth functions from Step 0 binding
- Query functions from Step 0

---

## Step 2 — SWR Hooks + Sessions List

**Goal**: Client-side data layer + sessions section in process overview.

### Files to CREATE

- `src/lib/hooks/use-sessions.ts` — `useSessions(processId)`, `useSession(sessionId)`
- `src/lib/utils/session-labels.ts` — display labels
- `src/components/sessions/sessions-list.tsx` — table/list
- `src/components/sessions/session-status-badge.tsx` — status badges

### Files to MODIFY

- `src/app/providers.tsx` (or equivalent) — add SWR global fetcher **IF missing per Step 0**
- `src/components/processes/process-overview.tsx` — add sessions section

### SWR Global Fetcher (if missing)

```typescript
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('API request failed');
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

// Wrap in <SWRConfig value={{ fetcher }}>
```

### SWR Hooks

```typescript
// src/lib/hooks/use-sessions.ts
import useSWR from 'swr';

// SessionListItem — lean type matching listSessionsByProcess return
// BINDING: Adjust field names to match actual schema
interface SessionListItem {
  id: string;
  processId: string;
  type: string;
  title: string;
  date: string;
  status: string;
  durationMinutes: number | null;
  createdBy: string;
  createdAt: string;
}

// SessionWithContacts — full type from GET /api/sessions/[sessionId]
// BINDING: Adjust field names to match actual schema
interface SessionWithContacts {
  id: string;
  processId: string;
  type: string;
  title: string;
  date: string;
  status: string;
  transcriptText: string | null;  // BINDING: SESSION_TRANSCRIPT_COL
  notes: string | null;            // BINDING: SESSION_NOTES_COL
  durationMinutes: number | null;
  prepBrief: unknown;
  synthesisOutput: unknown;        // BINDING: SESSION_SYNTHESIS_COL
  interviewAnswers: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  contacts: Array<{ id: string; name: string; email: string | null; role: string | null }>;
}

export function useSessions(processId: string | null) {
  const key = processId ? `/api/sessions?processId=${processId}` : null;
  const result = useSWR<SessionListItem[]>(key);
  return {
    ...result,
    sessions: result.data ?? [],
    isLoading: result.isLoading,
    mutateSessions: result.mutate,
  };
}

export function useSession(sessionId: string | null) {
  const key = sessionId ? `/api/sessions/${sessionId}` : null;
  const result = useSWR<SessionWithContacts>(key);
  return {
    ...result,
    session: result.data ?? null,
    isLoading: result.isLoading,
    mutateSession: result.mutate,
  };
}
```

### Display Labels

```typescript
// src/lib/utils/session-labels.ts
export const SESSION_TYPE_LABELS: Record<string, string> = {
  stakeholder_interview: 'Stakeholder Interview',
  process_walkthrough: 'Process Walkthrough',
  shadowing: 'Shadowing',
  document_review: 'Document Review',
  system_demo: 'System Demo',
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  synthesis_done: 'Synthesized',
};
```

### Sessions List Component

- Table: Title | Type | Date | Status | Contacts count
- Type uses `SESSION_TYPE_LABELS`
- Status uses `session-status-badge.tsx`
- Click row → `/clients/${clientId}/processes/${processId}/sessions/${session.id}`
- "New Session" button → opens creation dialog (Step 3)
- Empty state, loading skeleton, error state with retry
- Receives `clientId` and `processId` as props

### Status Badge Colors

| Status | Color |
|--------|-------|
| planned | gray/outline |
| in_progress | blue |
| completed | green |
| synthesis_done | purple |

### Prop Threading

```
page.tsx (extracts clientId, processId from params)
  → ProcessOverview (receives clientId, processId)
    → SessionsList (receives clientId, processId)
      → CreateSessionDialog (receives clientId, processId — Step 3)
```

Verify `process-overview.tsx` already receives `clientId` as a prop. If not, thread it from the page component.

### Tests

None (UI — visual verification).

---

## Step 3 — Session Creation Dialog

**Goal**: Multi-step dialog: type selector → per-type fields → create.

### Files to CREATE

- `src/components/sessions/create-session-dialog.tsx`
- `src/components/sessions/session-type-selector.tsx`
- `src/components/sessions/session-config-fields.tsx`

### Props Interface

```typescript
interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  processId: string;
  onCreated: () => void; // triggers mutateSessions()
}
```

### UI Flow

**Step 1 — Type Selection**: 5 cards:

| Type | Label | Description |
|------|-------|-------------|
| `stakeholder_interview` | Stakeholder Interview | Talk to key decision-makers |
| `process_walkthrough` | Process Walkthrough | Walk through step by step with an operator |
| `shadowing` | Shadowing | Observe an operator live |
| `document_review` | Document Review | Review SOPs, system exports |
| `system_demo` | System Demo | Watch system demonstrations |

All 5 types are shown (including `shadowing`). Phase 4 is "Non-Shadowing" only for the capture UI — the type selector and API support all types. Phase 5 adds the dedicated capture UI.

**Step 2 — Details**:
- Title (text, required)
- Date picker (required)
- Contact multi-select (uses `useContacts` hook from Step 0 check)
- Per-type config (stored in `interviewAnswers` JSONB):
  - `stakeholder_interview` / `process_walkthrough` / `document_review`: no extra fields
  - `shadowing`: focus area text input
  - `system_demo`: systems to demo (free text), scenarios textarea

**Step 3 — Interview (initially skipped, wired in Step 4)**:
- Before Step 4: details → submit directly
- After Step 4: details → interview → submit

### State Management

```typescript
const [step, setStep] = useState<'type' | 'details' | 'interview'>('type');
const [formData, setFormData] = useState({
  type: null as string | null,
  title: '',
  date: '',
  contactIds: [] as string[],
  interviewAnswers: null as { questions: { question: string; answer: string }[] } | null,
});
```

### Key Decisions

- Step 3 → Step 4 decoupling: In Step 3, details "Next" calls `handleSubmit()`. In Step 4, one-line change to `setStep('interview')`.
- Dialog resets state when `open` transitions to `true`.
- Submit button disabled while loading (prevents double-submit).
- On POST error: show toast, do NOT close dialog.
- Contact picker loading state handled.
- "Back" buttons on each step.

### Tests

None (UI — visual verification).

---

## Step 4 — AI Interview Route + UI

**Goal**: 3 adaptive interview questions using user's AI config.

### Files to CREATE

- `src/app/api/sessions/interview/route.ts`
- `src/lib/ai/prompts/session-interview.ts`
- `src/lib/ai/schemas/interview.ts`
- `src/components/sessions/interview-step.tsx`
- `src/__tests__/api/sessions-interview.test.ts`

### Files to MODIFY

- `src/components/sessions/create-session-dialog.tsx` — change `handleSubmit()` → `setStep('interview')`
- `src/lib/validations/session.ts` — add `interviewRequestSchema`

### Route Path Note

`/api/sessions/interview` is static — Next.js resolves it before `/api/sessions/[sessionId]`. Safe.

### Validation Schema

```typescript
// Add to src/lib/validations/session.ts
export const interviewRequestSchema = z.object({
  processId: z.string().uuid(),
  sessionType: sessionTypeEnum,
  previousAnswers: z.array(
    z.object({ question: z.string(), answer: z.string() })
  ).default([]),
  questionIndex: z.number().int().min(0).max(3),
});
```

### AI Schema

```typescript
// src/lib/ai/schemas/interview.ts
import { z } from 'zod';

export const interviewQuestionSchema = z.object({
  question: z.string().describe('A specific question for the FDE'),
  context: z.string().describe('Why this question matters'),
});
```

### Prompt Builder

```typescript
// src/lib/ai/prompts/session-interview.ts
import { SESSION_TYPE_LABELS } from '@/lib/utils/session-labels';

export function buildInterviewPrompt(params: {
  processContext: { name: string; description: string | null; hypothesisText: string | null; model: any | null };
  sessionType: string;
  previousAnswers: { question: string; answer: string }[];
  questionIndex: number;
}): string {
  const { processContext, sessionType, previousAnswers, questionIndex } = params;
  const typeLabel = SESSION_TYPE_LABELS[sessionType] ?? sessionType;

  const modelContext = processContext.model
    ? `Current process model steps: ${JSON.stringify(processContext.model.steps ?? [])}`
    : 'No process model exists yet.';

  const previousContext = previousAnswers.length > 0
    ? `Previous Q&A:\n${previousAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n\n')}`
    : 'First question.';

  return `You are helping an FDE prepare for a "${typeLabel}" session about "${processContext.name}".

Process description: ${processContext.description ?? 'None'}
Hypothesis: ${processContext.hypothesisText ?? 'None'}
${modelContext}

${previousContext}

Generate question ${questionIndex + 1} of 3. Build on previous answers. Focus areas by type:
- stakeholder_interview: decision-making, pain points, authority
- process_walkthrough: step-by-step flow, exceptions, handoffs
- document_review: coverage gaps, version control, document types
- system_demo: integrations, data flows, manual workarounds
- shadowing: observation targets, known gaps, edge-case scenarios

Return a focused question.`;
}
```

### Route Implementation

```typescript
// src/app/api/sessions/interview/route.ts
import { NextResponse } from 'next/server';
import { interviewRequestSchema } from '@/lib/validations/session';
import { interviewQuestionSchema } from '@/lib/ai/schemas/interview';
import { buildInterviewPrompt } from '@/lib/ai/prompts/session-interview';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { AUTH_WRITE_FN } from '@/lib/auth/utils';
import { parseJSON, handleAPIError } from 'ACTUAL_PATH';
import { generateObject } from 'ai';

export async function POST(request: Request) {
  try {
    const { userId } = await AUTH_WRITE_FN();
    const body = await parseJSON(request, interviewRequestSchema);

    if (body.questionIndex >= 3) {
      return NextResponse.json({ done: true });
    }

    const process = await getProcessWithModel(body.processId);
    if (!process) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const aiConfig = await getAIConfig('interview', userId);
    if (!aiConfig) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 422 });
    }

    const result = await generateObject({
      model: aiConfig.model,
      schema: interviewQuestionSchema,
      prompt: buildInterviewPrompt({
        processContext: {
          name: process.name,
          description: process.description,
          hypothesisText: process.hypothesisText ?? null,
          model: process.model,
        },
        sessionType: body.sessionType,
        previousAnswers: body.previousAnswers,
        questionIndex: body.questionIndex,
      }),
    });

    return NextResponse.json({ done: false, ...result.object });
  } catch (error) {
    console.error('AI interview failed:', error);
    return handleAPIError(error);
  }
}
```

### Interview Step Component

- Shows current question + context
- Textarea for answer
- "Next Question" button (disabled while loading)
- "Skip Interview" button (always available)
- Progress: "Question 1 of 3"
- Error → "Skip Interview" fallback
- On completion (`done: true`) → `handleSubmit()` with accumulated data

### Tests (~8)

- 401: unauthenticated
- 403: non-admin
- 400: missing `processId`
- 400: invalid `sessionType`
- 404: nonexistent process
- 422: no API key (mock `getAIConfig` → null)
- Happy: returns `{ done: false, question, context }` for `questionIndex: 0` (mock `generateObject`)
- Happy: returns `{ done: true }` for `questionIndex >= 3` (verify `generateObject` NOT called)

Mock pattern:
```typescript
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { question: 'Test question?', context: 'Test context' },
  }),
}));
```

---

## Step 5 — Session Detail Page

**Goal**: Full session detail with transcript + notes auto-save.

### Files to CREATE

- `src/app/(dashboard)/clients/[clientId]/processes/[processId]/sessions/[sessionId]/page.tsx`
- `src/components/sessions/session-overview.tsx`
- `src/components/sessions/session-detail-card.tsx`
- `src/components/sessions/transcript-notes-editor.tsx`

### Page Route

```typescript
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; processId: string; sessionId: string }>;
}) {
  const { clientId, processId, sessionId } = await params;
  return (
    <SessionOverview clientId={clientId} processId={processId} sessionId={sessionId} />
  );
}
```

### Auto-Save Pattern

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface TranscriptNotesEditorProps {
  sessionId: string;
  // BINDING: Use actual column names
  initialTranscript: string | null;  // SESSION_TRANSCRIPT_COL value
  initialNotes: string | null;       // SESSION_NOTES_COL value
  sessionStatus: string;
  mutateSession: () => void;
}

export function TranscriptNotesEditor({
  sessionId,
  initialTranscript,
  initialNotes,
  sessionStatus,
  mutateSession,
}: TranscriptNotesEditorProps) {
  const [localTranscript, setLocalTranscript] = useState(initialTranscript ?? '');
  const [localNotes, setLocalNotes] = useState(initialNotes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestTranscriptRef = useRef(localTranscript);
  const latestNotesRef = useRef(localNotes);
  const statusRef = useRef(sessionStatus);
  const isMountedRef = useRef(true);
  const lastSavedRef = useRef({
    transcript: initialTranscript ?? '',
    notes: initialNotes ?? '',
  });

  useEffect(() => { latestTranscriptRef.current = localTranscript; }, [localTranscript]);
  useEffect(() => { latestNotesRef.current = localNotes; }, [localNotes]);
  useEffect(() => { statusRef.current = sessionStatus; }, [sessionStatus]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Sync with server ONLY when data changed externally (not from our own save)
  useEffect(() => {
    const serverTranscript = initialTranscript ?? '';
    const serverNotes = initialNotes ?? '';
    if (serverTranscript !== lastSavedRef.current.transcript) {
      setLocalTranscript(serverTranscript);
      lastSavedRef.current.transcript = serverTranscript;
    }
    if (serverNotes !== lastSavedRef.current.notes) {
      setLocalNotes(serverNotes);
      lastSavedRef.current.notes = serverNotes;
    }
  }, [initialTranscript, initialNotes]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const transcript = latestTranscriptRef.current || null;
        const notes = latestNotesRef.current || null;

        // BINDING: Use actual column names in PATCH body
        const patchBody: Record<string, unknown> = {
          transcriptText: transcript,  // BINDING: SESSION_TRANSCRIPT_COL
          notes: notes,                // BINDING: SESSION_NOTES_COL
        };

        // Auto-transition planned → in_progress
        if (statusRef.current === 'planned') {
          patchBody.status = 'in_progress';
        }

        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        });
        if (!res.ok) throw new Error('Save failed');
        if (!isMountedRef.current) return;

        lastSavedRef.current = {
          transcript: transcript ?? '',
          notes: notes ?? '',
        };

        setSaveStatus('saved');
        mutateSession();
      } catch {
        if (!isMountedRef.current) return;
        setSaveStatus('error');
      }
    }, 2000);
  }, [sessionId, mutateSession]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Transcript</label>
        <textarea
          className="w-full min-h-[200px] mt-1 p-3 border rounded-md"
          value={localTranscript}
          onChange={(e) => { setLocalTranscript(e.target.value); scheduleSave(); }}
          placeholder="Paste or type your session transcript here..."
        />
      </div>
      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className="w-full min-h-[150px] mt-1 p-3 border rounded-md"
          value={localNotes}
          onChange={(e) => { setLocalNotes(e.target.value); scheduleSave(); }}
          placeholder="Your personal notes about this session..."
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved ✓'}
        {saveStatus === 'error' && (
          <button onClick={scheduleSave} className="text-red-500 underline">
            Error saving — click to retry
          </button>
        )}
      </div>
    </div>
  );
}
```

### Page Layout

- **Top**: Back button + title + type badge + status badge
- **Left column** (1/3): Detail card (type, date, duration, status, contacts) + Prep brief placeholder (Step 6)
- **Right column** (2/3): TranscriptNotesEditor
- **Bottom actions**:
  - `planned`/`in_progress` → "Mark as Completed"
  - `completed` → "Run Synthesis" (Step 7)
  - `synthesis_done` → Synthesis panels (Step 8)

### "Mark as Completed"

- If both transcript and notes empty → show warning dialog first
- "Mark Completed" button disabled while loading
- On success → `mutateSession()`

### Key Decisions

- Auto-transition `planned` → `in_progress` on first save
- Single debounce timer for both fields
- `lastSavedRef` prevents SWR revalidation from overwriting in-flight edits
- `isMountedRef` prevents state updates after unmount
- Uses `useSession(sessionId)` from Step 2

### Tests (~4)

- Auto-save debounce: verify fetch called once after delay with both fields (mock fetch + fake timers)
- Auto-transition: verify PATCH includes `status: 'in_progress'` when status is `planned`
- Warning dialog: appears when completing with empty transcript + notes
- `lastSavedRef` guard: local state preserved after mutateSession triggers re-render

---

## Step 6 — Prep Brief Generation

**Goal**: AI-generated prep brief.

### Files to CREATE

- `src/app/api/sessions/[sessionId]/prep-brief/route.ts`
- `src/lib/ai/prompts/prep-brief.ts`
- `src/lib/ai/schemas/prep-brief.ts`
- `src/components/sessions/prep-brief-card.tsx`
- `src/__tests__/api/sessions-prep-brief.test.ts`

### API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/sessions/[sessionId]/prep-brief` | AUTH_WRITE_FN |

### Zod Schema

```typescript
// src/lib/ai/schemas/prep-brief.ts
import { z } from 'zod';

export const prepBriefSchema = z.object({
  whatWeKnow: z.string().describe('Summary of what we know'),
  whatsOpen: z.string().describe('Gaps and unanswered questions'),
  suggestedFocus: z.array(z.string()).describe('3-5 focus areas'),
});

export type PrepBrief = z.infer<typeof prepBriefSchema>;
```

### Prompt Builder

```typescript
// src/lib/ai/prompts/prep-brief.ts
import { SESSION_TYPE_LABELS } from '@/lib/utils/session-labels';

export function buildPrepBriefPrompt(params: {
  session: { type: string; interviewAnswers: any };
  process: { name: string; description: string | null; model: any | null };
  priorSessions: Array<{ type: string; title: string; synthesisOutput: any; transcriptText: string | null }>;
  // BINDING: Adjust field names
}): string {
  const { session, process, priorSessions } = params;
  const typeLabel = SESSION_TYPE_LABELS[session.type] ?? session.type;

  const modelSection = process.model
    ? `Current process model:\nSteps: ${JSON.stringify(process.model.steps ?? [])}\nSystems: ${JSON.stringify(process.model.systems ?? [])}\nEdge Cases: ${JSON.stringify(process.model.edgeCases ?? [])}`
    : 'No process model yet — this is one of the first sessions.';

  const priorContext = priorSessions.length > 0
    ? priorSessions.map(s => {
        // BINDING: SESSION_SYNTHESIS_COL
        const summary = (s.synthesisOutput as any)?.summary;
        return `- ${SESSION_TYPE_LABELS[s.type] ?? s.type}: "${s.title}"${summary ? ` — ${summary}` : ''}`;
      }).join('\n')
    : 'No prior sessions.';

  const interviewContext = session.interviewAnswers
    ? `Interview prep: ${JSON.stringify(session.interviewAnswers)}`
    : 'No interview prep.';

  return `You are helping an FDE prepare for a "${typeLabel}" session for "${process.name}".

${process.description ? `Description: ${process.description}` : ''}
${modelSection}

Prior sessions:\n${priorContext}

${interviewContext}

Generate:
1. whatWeKnow: What we understand from model + prior sessions
2. whatsOpen: Gaps, unanswered questions
3. suggestedFocus: 3-5 specific focus areas for this ${typeLabel}`;
}
```

### Route Implementation

```typescript
// src/app/api/sessions/[sessionId]/prep-brief/route.ts
import { NextResponse } from 'next/server';
import { prepBriefSchema } from '@/lib/ai/schemas/prep-brief';
import { buildPrepBriefPrompt } from '@/lib/ai/prompts/prep-brief';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getSessionById, getCompletedSessionsByProcess, updateSession } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { AUTH_WRITE_FN } from '@/lib/auth/utils';
import { handleAPIError } from 'ACTUAL_PATH';
import { generateObject } from 'ai';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await AUTH_WRITE_FN();

    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const aiConfig = await getAIConfig('interview', userId); // Haiku
    if (!aiConfig) return NextResponse.json({ error: 'No API key' }, { status: 422 });

    const process = await getProcessWithModel(session.processId);
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    const priorSessions = await getCompletedSessionsByProcess(session.processId);

    const result = await generateObject({
      model: aiConfig.model,
      schema: prepBriefSchema,
      prompt: buildPrepBriefPrompt({
        session,
        process,
        priorSessions: priorSessions.filter(s => s.id !== sessionId),
      }),
    });

    // BINDING: SESSION_PREP_BRIEF_COL — direct call, no Zod
    await updateSession(sessionId, { prepBrief: result.object });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error('Prep brief failed:', error);
    return handleAPIError(error);
  }
}
```

### Prep Brief Card

- 3 sections: "What We Know", "What's Open", "Suggested Focus" (numbered list)
- "Regenerate" button (disabled while loading)
- If not generated: "Generate Prep Brief" CTA
- If no API key: disabled button with tooltip

### Tests (~6)

- 401: unauthenticated
- 403: non-admin
- 404: nonexistent session
- 422: no API key
- Happy: returns brief, `prepBrief` column populated (mock `generateObject`)
- Happy: regenerate overwrites previous

---

## Step 7 — Non-Shadowing Synthesis

**Goal**: AI analyzes transcript + notes → produces structured diff.

### Files to CREATE

- `src/app/api/sessions/[sessionId]/synthesize/route.ts`
- `src/lib/ai/prompts/session-synthesis.ts`
- `src/lib/ai/schemas/synthesis.ts`
- `src/__tests__/api/sessions-synthesize.test.ts`

### API

| Method | Path | Auth | Preconditions |
|--------|------|------|--------------|
| POST | `/api/sessions/[sessionId]/synthesize` | AUTH_WRITE_FN | Status = `completed`. Transcript OR notes non-empty. |

### Synthesis Output Schema

```typescript
// src/lib/ai/schemas/synthesis.ts
import { z } from 'zod';

// 🔧 FIX: Use actual enum values from binding table

export const synthesisStepSchema = z.object({
  stepId: z.string().nullable().describe('ID of existing step, or null for new'),
  name: z.string(),
  description: z.string(),
  order: z.number(),
  // BINDING: STEP_CONFIDENCE_VALUES — original spec uses 'missing', NOT 'gap'
  confidence: z.enum(['confirmed', 'inferred', 'missing']),
  systems: z.array(z.string()),
  changeType: z.enum(['unchanged', 'modified', 'new', 'removed']),
  changeReason: z.string().optional(),
});

export const synthesisEdgeCaseSchema = z.object({
  edgeCaseId: z.string().nullable(),
  description: z.string(),
  // BINDING: EDGE_CASE_FREQUENCY_VALUES
  frequency: z.enum(['rare', 'occasional', 'frequent', 'unknown']),
  suggestedHandling: z.string(),
  changeType: z.enum(['unchanged', 'modified', 'new']),
});

// 🔧 FIX: SystemEntry uses 'details' and 'gaps' per original spec, not 'detailNotes' and 'role'
export const synthesisSystemSchema = z.object({
  name: z.string(),
  confirmed: z.boolean(),
  // BINDING: SYSTEM_ENTRY_DETAIL_FIELD — likely 'details' or 'detailNotes'
  role: z.string().describe('What role this system plays'),
  details: z.string().describe('Specific details about how the system is used'),
  gaps: z.string().optional().describe('Unknown information about this system'),
  changeType: z.enum(['unchanged', 'modified', 'new']),
});

export const synthesisQuestionSchema = z.object({
  text: z.string(),
  // BINDING: Must match questionPriority enum
  priority: z.enum(['must_answer', 'nice_to_have', 'parked']),
});

export const synthesisOutputSchema = z.object({
  summary: z.string().describe('2-3 sentence summary'),
  steps: z.array(synthesisStepSchema),
  edgeCases: z.array(synthesisEdgeCaseSchema),
  systems: z.array(synthesisSystemSchema),
  openQuestions: z.array(synthesisQuestionSchema),
  confidence: z.number().min(0).max(100),
});

export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>;
```

### Prompt Builder

```typescript
// src/lib/ai/prompts/session-synthesis.ts
import { SESSION_TYPE_LABELS } from '@/lib/utils/session-labels';

export function buildSynthesisPrompt(params: {
  session: {
    type: string;
    transcriptText: string | null;  // BINDING: SESSION_TRANSCRIPT_COL
    notes: string | null;
    interviewAnswers: any;
  };
  processName: string;
  processDescription: string | null;
  processModel: { steps: any[]; systems: any[]; edgeCases: any[] } | null;
  priorSessionSummaries: string[];
}): string {
  const { session, processName, processModel, priorSessionSummaries } = params;
  const typeLabel = SESSION_TYPE_LABELS[session.type] ?? session.type;

  const modelSection = processModel
    ? `## Current Process Model\nSteps: ${JSON.stringify(processModel.steps)}\nSystems: ${JSON.stringify(processModel.systems)}\nEdge Cases: ${JSON.stringify(processModel.edgeCases)}`
    : `## Current Process Model\nNone. Generate from scratch. All steps: changeType "new", stepId null.`;

  return `You are analyzing a ${typeLabel} session for "${processName}".

${processDescription ? `Description: ${processDescription}` : ''}
${modelSection}

## Session Input
Transcript:
${session.transcriptText ?? 'No transcript'}

Notes:
${session.notes ?? 'No notes'}

Interview Answers:
${session.interviewAnswers ? JSON.stringify(session.interviewAnswers) : 'None'}

Prior Context:
${priorSessionSummaries.length > 0 ? priorSessionSummaries.join('\n---\n') : 'None'}

## Instructions
Compare session data against current model.
For each step:
- Exists + unchanged: changeType "unchanged", use existing stepId
- Exists + changed: changeType "modified", use existing stepId, include changeReason
- New: changeType "new", stepId null, include changeReason
- Should be removed: changeType "removed", use existing stepId, include changeReason

IMPORTANT: stepId values must exactly match existing model step IDs. Use null for new.

For systems: use the actual field names from the model (name, confirmed, role, details, gaps).
Flag edge cases and generate open questions.`;
}
```

### Route Implementation

```typescript
// src/app/api/sessions/[sessionId]/synthesize/route.ts
import { NextResponse } from 'next/server';
import { synthesisOutputSchema } from '@/lib/ai/schemas/synthesis';
import { buildSynthesisPrompt } from '@/lib/ai/prompts/session-synthesis';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { getSessionById, getCompletedSessionsByProcess, updateSession } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { AUTH_WRITE_FN } from '@/lib/auth/utils';
import { handleAPIError } from 'ACTUAL_PATH';
import { generateObject } from 'ai';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await AUTH_WRITE_FN();

    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: `Session must be completed. Current: ${session.status}` },
        { status: 400 }
      );
    }

    // BINDING: SESSION_TRANSCRIPT_COL and SESSION_NOTES_COL
    const transcript = (session as any).transcriptText; // BINDING
    const notes = (session as any).notes;               // BINDING
    if (!transcript && !notes) {
      return NextResponse.json(
        { error: 'Session must have transcript or notes' },
        { status: 400 }
      );
    }

    const aiConfig = await getAIConfig('synthesis', userId); // Sonnet
    if (!aiConfig) return NextResponse.json({ error: 'No API key' }, { status: 422 });

    const process = await getProcessWithModel(session.processId);
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    const priorSessions = await getCompletedSessionsByProcess(session.processId);
    const priorSummaries = priorSessions
      .filter(s => s.id !== sessionId && (s as any).synthesisOutput) // BINDING
      .map(s => ((s as any).synthesisOutput as any)?.summary ?? '')
      .filter(Boolean);

    const result = await generateObject({
      model: aiConfig.model,
      schema: synthesisOutputSchema,
      maxTokens: 4096,
      prompt: buildSynthesisPrompt({
        session: { type: session.type, transcriptText: transcript, notes, interviewAnswers: session.interviewAnswers },
        processName: process.name,
        processDescription: process.description,
        processModel: process.model
          ? { steps: process.model.steps ?? [], systems: process.model.systems ?? [], edgeCases: process.model.edgeCases ?? [] }
          : null,
        priorSessionSummaries: priorSummaries,
      }),
    });

    // BINDING: SESSION_SYNTHESIS_COL — direct call, no Zod
    await updateSession(sessionId, {
      synthesisOutput: result.object, // BINDING
      status: 'synthesis_done',
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error('Synthesis failed:', error);
    return handleAPIError(error);
  }
}
```

### Key Decisions

- Uses `getAIConfig('synthesis')` — Sonnet tier
- `maxTokens: 4096` — prevents truncation
- Synchronous (user waits with loading spinner)
- Does NOT auto-apply — produces diff for review (Step 8)
- Handles null process model
- Re-synthesis not supported in v1 (must be `completed` status)

### Tests (~9)

- 401: unauthenticated
- 403: non-admin
- 404: nonexistent session
- 400: status is `planned`
- 400: status is `in_progress`
- 400: status is `synthesis_done`
- 400: both transcript and notes null
- 422: no API key
- Happy: returns synthesis, status updated to `synthesis_done`, synthesis column populated (mock `generateObject`)

---

## Step 8 — Synthesis Display + Apply

**Goal**: Show synthesis as collapsible panels with section-level apply.

### Files to CREATE

- `src/components/sessions/synthesis-panels.tsx`
- `src/lib/utils/merge-process-model.ts`
- `src/lib/validations/apply-synthesis.ts`
- `src/app/api/sessions/[sessionId]/apply-synthesis/route.ts`
- `src/__tests__/api/sessions-apply-synthesis.test.ts`
- `src/__tests__/utils/merge-process-model.test.ts`

### Synthesis Panels Component

Four collapsible sections:

**1. Steps Panel**: Color-coded — new=green, modified=amber, removed=red strikethrough, unchanged=default. Section toggle: "Include steps".

**2. Edge Cases Panel**: New/modified indicators. Section toggle: "Include edge cases".

**3. Systems Panel**: Change badges. Section toggle: "Include systems".

**4. Open Questions Panel**: Priority badges (must_answer=red, nice_to_have=yellow, parked=gray). Section toggle: "Include open questions".

**Bottom**: "Apply Selected Changes" button + confidence display. Once applied, button becomes "Changes Applied" (disabled).

### Apply Schema

```typescript
// src/lib/validations/apply-synthesis.ts
import { z } from 'zod';

export const applySynthesisSchema = z.object({
  applySteps: z.boolean().default(true),
  applyEdgeCases: z.boolean().default(true),
  applySystems: z.boolean().default(true),
  applyQuestions: z.boolean().default(true),
});
```

### Merge Functions

```typescript
// src/lib/utils/merge-process-model.ts
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';

/**
 * Merges synthesis steps into existing model steps.
 * Skips invalid stepId references (logs warning, doesn't crash).
 * Re-normalizes order after merge.
 */
export function mergeSteps(
  current: any[],
  synthesisSteps: SynthesisOutput['steps']
): any[] {
  const result = [...current];

  for (const s of synthesisSteps) {
    switch (s.changeType) {
      case 'new':
        result.push({
          id: crypto.randomUUID(),
          name: s.name,
          description: s.description,
          order: s.order,
          confidence: s.confidence,
          systems: s.systems,
          // 🔧 FIX: Preserve additional JSONB fields from original spec
          next_steps: [],
          branch_condition: null,
          related_edge_cases: [],
          notes: '',
        });
        break;

      case 'modified':
        if (s.stepId) {
          const idx = result.findIndex(r => r.id === s.stepId);
          if (idx !== -1) {
            result[idx] = {
              ...result[idx], // Preserves source_session_id, next_steps, etc.
              name: s.name,
              description: s.description,
              order: s.order,
              confidence: s.confidence,
              systems: s.systems,
            };
          } else {
            console.warn(`Unknown stepId: ${s.stepId} — skipping`);
          }
        }
        break;

      case 'removed':
        if (s.stepId) {
          const idx = result.findIndex(r => r.id === s.stepId);
          if (idx !== -1) result.splice(idx, 1);
          else console.warn(`Unknown stepId for removal: ${s.stepId} — skipping`);
        }
        break;
      // 'unchanged': skip
    }
  }

  return result
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((step, i) => ({ ...step, order: i }));
}

/**
 * Merges edge cases. Preserves 'status' and 'related_step_id' from originals.
 */
export function mergeEdgeCases(
  current: any[],
  synthesisEdgeCases: SynthesisOutput['edgeCases']
): any[] {
  const result = [...current];

  for (const ec of synthesisEdgeCases) {
    switch (ec.changeType) {
      case 'new':
        result.push({
          id: crypto.randomUUID(),
          description: ec.description,
          frequency: ec.frequency,
          suggestedHandling: ec.suggestedHandling,
          // 🔧 FIX: Include fields from original JSONB spec
          status: 'open',
          related_step_id: null,
        });
        break;

      case 'modified':
        if (ec.edgeCaseId) {
          const idx = result.findIndex(r => r.id === ec.edgeCaseId);
          if (idx !== -1) {
            result[idx] = {
              ...result[idx], // Preserves status, related_step_id, source_session_id
              description: ec.description,
              frequency: ec.frequency,
              suggestedHandling: ec.suggestedHandling,
            };
          } else {
            console.warn(`Unknown edgeCaseId: ${ec.edgeCaseId} — skipping`);
          }
        }
        break;
      // 'unchanged': skip
    }
  }
  return result;
}

/**
 * Merges systems. Matched by name (case-insensitive).
 * 🔧 FIX: Uses 'details' and 'gaps' fields per original JSONB spec.
 */
export function mergeSystems(
  current: any[],
  synthesisSystems: SynthesisOutput['systems']
): any[] {
  const result = [...current];

  for (const sys of synthesisSystems) {
    switch (sys.changeType) {
      case 'new': {
        const exists = result.some(r => r.name.toLowerCase() === sys.name.toLowerCase());
        if (!exists) {
          result.push({
            id: crypto.randomUUID(),
            name: sys.name,
            confirmed: sys.confirmed,
            // BINDING: SYSTEM_ENTRY_DETAIL_FIELD — use actual field names
            role: sys.role,
            details: sys.details,
            gaps: sys.gaps ?? '',
          });
        }
        break;
      }

      case 'modified': {
        const idx = result.findIndex(r => r.name.toLowerCase() === sys.name.toLowerCase());
        if (idx !== -1) {
          result[idx] = {
            ...result[idx],
            confirmed: sys.confirmed,
            role: sys.role,
            details: sys.details,
            gaps: sys.gaps ?? result[idx].gaps ?? '',
          };
        }
        break;
      }
      // 'unchanged': skip
    }
  }
  return result;
}
```

### Apply Route — WITH Transaction

```typescript
// src/app/api/sessions/[sessionId]/apply-synthesis/route.ts
import { NextResponse } from 'next/server';
import { applySynthesisSchema } from '@/lib/validations/apply-synthesis';
import { mergeSteps, mergeEdgeCases, mergeSystems } from '@/lib/utils/merge-process-model';
import { getSessionById } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { db } from '@/lib/db';
import { processModels, processModelSnapshots, openQuestions } from '@/lib/db/schema';
import { AUTH_WRITE_FN } from '@/lib/auth/utils';
import { parseJSON, handleAPIError } from 'ACTUAL_PATH';
import { SESSION_TYPE_LABELS } from '@/lib/utils/session-labels';
import { eq } from 'drizzle-orm';
import type { SynthesisOutput } from '@/lib/ai/schemas/synthesis';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { userId } = await AUTH_WRITE_FN();

    // --- Reads OUTSIDE transaction ---
    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // BINDING: SESSION_SYNTHESIS_COL
    const synthesisData = (session as any).synthesisOutput;
    if (!synthesisData) {
      return NextResponse.json({ error: 'No synthesis result' }, { status: 400 });
    }

    const body = await parseJSON(request, applySynthesisSchema);
    const synthesis = synthesisData as SynthesisOutput;

    const process = await getProcessWithModel(session.processId);
    if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

    // --- All writes INSIDE transaction using tx directly ---
    const result = await db.transaction(async (tx) => {
      let currentModel = process.model;

      // If no model exists, create empty one
      if (!currentModel) {
        const [created] = await tx
          .insert(processModels)
          .values({
            processId: session.processId,
            steps: [],
            systems: [],
            edgeCases: [],
            // BINDING: If PROCESS_MODEL_VERSION_COL exists, set version: 0
          })
          .returning();
        currentModel = created;
      }

      // 1. Snapshot current model BEFORE changes
      // 🔧 FIX: Use actual snapshot column names from binding table
      // BINDING: SNAPSHOT_DATA_COL, SNAPSHOT_TRIGGER_COL, SNAPSHOT_TRIGGER_VALUES
      await tx.insert(processModelSnapshots).values({
        processModelId: currentModel.id,
        // BINDING: If columns are trigger/state:
        trigger: 'synthesis_apply',  // Must be valid snapshotTriggerEnum value
        state: {
          steps: currentModel.steps ?? [],
          systems: currentModel.systems ?? [],
          edgeCases: currentModel.edgeCases ?? [],
        },
        sessionId: sessionId,
        // BINDING: If columns are snapshotData/version/changeDescription instead:
        // snapshotData: { steps, systems, edgeCases },
        // version: currentModel.version ?? 0,
        // changeDescription: `Synthesis from ${SESSION_TYPE_LABELS[session.type]} "${session.title}"`,
      });

      // 2. Merge (pure functions)
      let updatedSteps = [...(currentModel.steps as any[] ?? [])];
      let updatedEdgeCases = [...(currentModel.edgeCases as any[] ?? [])];
      let updatedSystems = [...(currentModel.systems as any[] ?? [])];

      if (body.applySteps) updatedSteps = mergeSteps(updatedSteps, synthesis.steps);
      if (body.applyEdgeCases) updatedEdgeCases = mergeEdgeCases(updatedEdgeCases, synthesis.edgeCases);
      if (body.applySystems) updatedSystems = mergeSystems(updatedSystems, synthesis.systems);

      // 3. Update model
      // BINDING: If PROCESS_MODEL_VERSION_COL exists, bump version
      const updatePayload: Record<string, unknown> = {
        steps: updatedSteps,
        systems: updatedSystems,
        edgeCases: updatedEdgeCases,
        updatedAt: new Date(),
      };

      // BINDING: Only include version if column exists
      // const newVersion = ((currentModel as any).version ?? 0) + 1;
      // updatePayload.version = newVersion;

      await tx
        .update(processModels)
        .set(updatePayload)
        .where(eq(processModels.id, currentModel.id));

      // 4. Open questions
      // BINDING: OPEN_QUESTION_TEXT_COL — 'question' or 'text'
      if (body.applyQuestions && synthesis.openQuestions.length > 0) {
        for (const q of synthesis.openQuestions) {
          await tx.insert(openQuestions).values({
            processId: session.processId,
            sessionId: sessionId,
            question: q.text,  // BINDING: actual column name
            priority: q.priority,
            status: 'open',
            createdBy: userId,
          });
        }
      }

      return { success: true };
      // BINDING: If version exists, return { success: true, newVersion }
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

### Merge Function Tests (~15)

**Note**: If `crypto.randomUUID()` isn't available in test env:
```typescript
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;
```

- `mergeSteps`: adds new step with UUID
- `mergeSteps`: modifies existing by stepId (preserves `next_steps`, `source_session_id`)
- `mergeSteps`: removes existing by stepId
- `mergeSteps`: skips invalid stepId for modified
- `mergeSteps`: skips invalid stepId for removed
- `mergeSteps`: re-normalizes order to sequential integers
- `mergeSteps`: handles order collisions
- `mergeSteps`: leaves unchanged untouched
- `mergeSteps`: handles empty current + new steps
- `mergeEdgeCases`: adds new with `status: 'open'`
- `mergeEdgeCases`: modifies existing, preserves `status` and `related_step_id`
- `mergeEdgeCases`: skips invalid edgeCaseId
- `mergeSystems`: adds new (not duplicate)
- `mergeSystems`: modifies by name (case-insensitive)
- `mergeSystems`: does NOT add duplicate name

### API Tests (~10)

- 401: unauthenticated
- 403: non-admin
- 404: nonexistent session
- 400: no synthesis data on session
- Happy: apply all → model updated, snapshot created
- Happy: apply steps only → only steps change
- Happy: snapshot contains pre-apply state
- Happy: open questions created with correct processId, sessionId, priority, createdBy
- Happy: apply with null model → creates empty model first
- Happy: apply twice → two snapshots

### Risks

- **Snapshot column names**: The two spec variants disagree. Step 0 binding table resolves this.
- **Merge handles hallucinated IDs**: Logs warning, doesn't crash.
- **Null process model**: Creates empty model first.
- **Version conflict**: Last-write-wins — acceptable for v1.
- **Transaction atomicity**: All writes use `tx` directly, not query helpers.
- **JSONB field preservation**: Merge functions use spread (`...result[idx]`) to preserve fields not in the synthesis output (e.g., `source_session_id`, `next_steps`, `related_step_id`).

---

## Summary

| Step | Tests | Files Created | Files Modified |
|------|-------|---------------|----------------|
| 0. Schema audit + query layer | 0 | 0-3 | 1-5 |
| 1. CRUD API | ~26 | 5 | 0 |
| 2. SWR + List | 0 | 4 | 1-2 |
| 3. Creation Dialog | 0 | 3 | 0 |
| 4. AI Interview | ~8 | 5 | 2 |
| 5. Detail Page | ~4 | 4 | 0 |
| 6. Prep Brief | ~6 | 5 | 0 |
| 7. Synthesis | ~9 | 4 | 0 |
| 8. Apply + UI | ~25 | 6 | 0 |
| **Total** | **~78** | **36-39** | **4-9** |

Expected total: ~235 tests (157 + ~78).

---

## Pre-Implementation Checklist

Before writing ANY code, the developer must complete the Step 0 binding table by reading `src/lib/db/schema.ts`:

- [ ] Fill in ALL binding table entries from Step 0
- [ ] Document bindings in a comment at top of `src/lib/validations/session.ts`
- [ ] Session type enum: `stakeholder_interview`, `process_walkthrough`, `shadowing`, `document_review`, `system_demo`
- [ ] Session status enum includes `synthesis_done`
- [ ] Session transcript column name: _______
- [ ] Session notes column exists: _______
- [ ] Session synthesis column name: _______
- [ ] Session date column type (date vs timestamp): _______
- [ ] processModels has version column: _______ (YES → use it / NO → add or skip)
- [ ] processModelSnapshots column names: _______ (trigger/state OR snapshotData/version/changeDescription)
- [ ] snapshotTriggerEnum values: _______
- [ ] sessionContacts has roleInSession: _______ (if yes, handle in POST)
- [ ] Open questions text column: _______
- [ ] stepConfidence values: _______ (includes 'missing' or 'gap'?)
- [ ] edgeCaseFrequency values: _______
- [ ] SystemEntry JSONB fields: _______ (details/gaps OR detailNotes/role?)
- [ ] Auth functions: read=_______ write=_______
- [ ] handleAPIError path: _______
- [ ] parseJSON path: _______
- [ ] SWR global fetcher: _______ (EXISTS / MUST ADD)
- [ ] getAIConfig tiers: interview=_______ synthesis=_______

**If any binding doesn't match the plan's default values, update the Zod schemas and code BEFORE writing tests.**

---

## Verification Plan

### After each step

1. `npx vitest run` — all tests pass
2. `npm run build` — no TypeScript errors
3. Manual browser check for UI steps

### End-to-end (after all 8 steps)

1. Navigate to process → sessions section (empty)
2. "New Session" → type → fields → (optional) interview → create
3. Session appears in list → click → detail page
4. Generate prep brief → 3 sections display
5. Type transcript → 2s → "Saved ✓"
6. Type notes → 2s → "Saved ✓"
7. Verify auto-transition planned → in_progress
8. "Mark as Completed"
9. "Run Synthesis" → loading → panels appear
10. Toggle section checkboxes → "Apply Selected Changes"
11. Button disabled ("Changes Applied")
12. Back to process → model updated
13. Check DB: snapshot created, open questions created

---

## Files NOT Touched

- `src/lib/db/schema.ts` — only in Step 0 if columns missing
- `src/components/ui/*` — shadcn auto-generated
- Phase 5/6/7 code
- `CLAUDE.md`