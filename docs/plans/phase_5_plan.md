# Phase 5 — Shadowing Capture (Hybrid Approach)

**Goal:** Build the real-time shadowing capture experience — the most critical UI in the app. Used on iPad during live client sessions.

**Duration:** 4 days

**Precondition:** Phase 4 complete (257 tests passing). Session CRUD, detail pages, prep brief, and transcript paste all functional.

**Gate:** Full capture flow works on desktop + iPad (1024×768). All 5 event types log correctly. Suggestions load. Offline queue syncs. End Session → post-capture → navigate to session detail. All ~312+ tests pass, zero regressions.

---

## Context

The user's mockup differs from the original spec layout. We take a **hybrid approach**: the user's mockup layout (horizontal buttons, text-first input, full-width event log, analytics sidebar) combined with the spec's features (system picker with detail notes, AI suggestion chips, offline sync, post-capture screen).

---

## Event Type Design Decision

### Current state (Phase 1)

The `eventTypeEnum` is a Postgres enum defined in Phase 1 with values `['STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION']`. These are exactly the 5 capture event types we need.

### Decision: Keep the pgEnum, add application-level constants

The Phase 1 schema already has the correct enum values. **We do NOT migrate to a text column.** Doing so introduces migration risk for zero immediate benefit — the values are already correct. Instead, we:

1. **Keep** `eventTypeEnum` as-is in the schema.
2. **Export** an `EVENT_TYPES` constant array from the schema file for application-level use (type-safe iteration, validation in Zod schemas, UI rendering).
3. **Defer** the pgEnum → text migration to a future housekeeping phase if/when new event types are needed.

The 5 capture event types are:

| Type | Button | Color | Behavior |
|------|--------|-------|----------|
| `STEP` | Proceso | emerald-600 | Input panel with suggestions |
| `EDGE` | Edge Case | amber-600 | Input panel with suggestions |
| `SYSTEM` | Sistema | violet-600 | 8-button grid picker + detail notes |
| `IMPLICIT` | Implícito | red-600 | Instant log, inline label editor |
| `QUESTION` | Pregunta | blue-600 | Instant log, inline text editor |

> **Why these 5 and not more?** During a live shadowing session, the FDE needs to make split-second decisions about what type of event they're seeing. 5 buttons is the maximum for rapid categorization without cognitive overhead. Each type maps to a distinct physical action: STEP = "they did something in the flow", EDGE = "something unexpected happened", SYSTEM = "a new tool appeared", IMPLICIT = "they did something from memory", QUESTION = "I need to ask about this later".

---

## Existing Codebase Reference (Step 0 — Binding Table)

Before writing any code, the junior developer must run these commands to resolve actual file paths, naming conventions, and confirm what exists:

```bash
# 1. Confirm current eventTypeEnum definition and usage
grep -rn "eventTypeEnum" src/lib/db/schema.ts
grep -rn "eventTypeEnum" src/__tests__/

# 2. Confirm existing event-related query functions
ls src/lib/db/queries/events.ts 2>/dev/null || echo "DOES NOT EXIST"
cat src/lib/db/queries/events.ts 2>/dev/null || echo "NO FILE"

# 3. Confirm auth utility exports
grep -n "export" src/lib/auth/utils.ts

# 4. Confirm API utility exports (specifically parseJSON and handleAPIError)
grep -n "export" src/lib/api/utils.ts
grep -n "parseJSON\|handleAPIError" src/lib/api/utils.ts

# 5. Confirm existing AI infrastructure
ls src/lib/ai/get-ai-config.ts src/lib/ai/context-builder.ts 2>/dev/null
grep -n "getAIConfig" src/lib/ai/get-ai-config.ts
grep -n "buildAIContext" src/lib/ai/context-builder.ts

# 6. Confirm session PATCH route exists, its path, AND which fields it accepts
find src/app/api -path "*/sessions*" -name "route.ts" | head -20
# THEN: Read the PATCH handler to confirm accepted fields:
grep -A30 "export async function PATCH" src/app/api/sessions/\[sessionId\]/route.ts 2>/dev/null || echo "NO PATCH ROUTE"

# 7. Confirm session status enum values
grep -A5 "sessionStatusEnum" src/lib/db/schema.ts

# 8. Confirm existing enum test file
cat src/__tests__/unit/db/enum-constants.test.ts 2>/dev/null || echo "NO FILE"

# 9. Confirm eventLogs table columns AND their Drizzle types
grep -A20 "eventLogs = pgTable" src/lib/db/schema.ts

# 10. Confirm open questions query functions and API routes
grep -rn "createOpenQuestion\|insertOpenQuestion\|openQuestion" src/lib/db/queries/*.ts
find src/app/api -path "*questions*" -name "route.ts" | head -10

# 11. Confirm dashboard layout structure — does sidebar render INSIDE or OUTSIDE children?
cat src/app/\(dashboard\)/layout.tsx

# 12. Confirm Clerk mock setup for tests
cat src/__tests__/mocks/clerk.ts | head -30

# 13. Confirm existing session detail/overview component
find src/components/sessions -name "*.tsx" | head -20

# 14. Confirm getL1 function location and signature
grep -rn "export.*getL1\|export.*function getL1" src/lib/

# 15. Confirm getProcessWithModel AND getProcessById functions exist
grep -rn "getProcessWithModel" src/lib/db/queries/
grep -rn "getProcessById" src/lib/db/queries/

# 16. Confirm getAIConfig accepts 'suggestions' profile — list all existing profiles
grep -rn "suggestions\|haiku\|model.*profiles\|getAIConfig" src/lib/ai/get-ai-config.ts

# 17. Confirm Clerk middleware matcher pattern — does it cover /capture/* ?
cat src/middleware.ts

# 18. Confirm the eventLogs.timestamp column type (timestamp vs timestamptz vs text)
grep -B2 -A2 "timestamp" src/lib/db/schema.ts | head -20

# 19. Confirm root layout has ClerkProvider (needed for (capture) route group)
grep -n "ClerkProvider" src/app/layout.tsx

# 20. Confirm event log table has no data yet (via Supabase MCP or direct query)
# This determines if we need data migration for the EVENT_TYPES constant addition

# 21. Confirm sessions table has transcriptText, notes, durationMinutes, AND type columns
grep -A40 "sessions = pgTable\|shadowingSessions" src/lib/db/schema.ts | head -50

# 22. Confirm session validation schema accepts transcriptText, notes, durationMinutes in PATCH
grep -rn "transcriptText\|durationMinutes" src/lib/validations/session.ts 2>/dev/null || echo "NO SESSION VALIDATION FILE"

# 23. Confirm eventLogs table has a deletedAt column for soft deletes
grep -A25 "eventLogs = pgTable" src/lib/db/schema.ts | grep -i "deletedAt\|deleted_at"

# 24. Confirm whether other query files use soft-delete filters (establish the pattern)
grep -rn "isNull.*deletedAt\|deletedAt.*isNull\|deletedAt.*is.*null" src/lib/db/queries/*.ts | head -10

# 25. Confirm Vercel AI SDK is installed and generateObject is available
grep -n "\"ai\"" package.json 2>/dev/null || echo "AI SDK NOT IN PACKAGE.JSON"
grep -rn "generateObject" src/ | head -10
# Check SDK version — generateObject with schema param requires v3+
cat node_modules/ai/package.json 2>/dev/null | grep '"version"' || echo "AI SDK NOT INSTALLED"

# 26. Confirm eventTypeEnum.enumValues type shape (for Zod compatibility)
# Run a quick TS check or inspect the Drizzle source to confirm it returns
# readonly [string, ...string[]] vs [string, ...string[]]
grep -rn "enumValues" node_modules/drizzle-orm/pg-core/columns/enum.d.ts 2>/dev/null | head -5

# 27. Confirm sessions table has a 'type' column (shadowing vs interview)
grep -A40 "sessions = pgTable\|shadowingSessions" src/lib/db/schema.ts | grep -i "type"
# Also check the sessionTypeEnum if it exists:
grep -n "sessionTypeEnum\|sessionType" src/lib/db/schema.ts

# 28. Confirm the session detail page route path structure
find src/app -path "*sessions*" -name "page.tsx" | head -10
# Verify the exact nesting: /clients/[clientId]/processes/[processId]/sessions/[sessionId]
ls -d src/app/\(dashboard\)/clients/\[clientId\]/processes/\[processId\]/sessions/\[sessionId\]/ 2>/dev/null || echo "PATH DOES NOT EXIST"
# If not found, try alternative patterns:
find src/app -type d -name "\[sessionId\]" | head -10

# 29. Confirm org-scoping pattern in existing queries (for authorization)
grep -rn "orgId\|organizationId\|org_id" src/lib/db/queries/*.ts | head -10
grep -rn "requireOrg\|getOrgId\|organizationId" src/lib/auth/utils.ts | head -10

# 30. Confirm Drizzle ORM version (for sql<number> generic type support)
cat node_modules/drizzle-orm/package.json 2>/dev/null | grep '"version"' || echo "DRIZZLE NOT INSTALLED"

# 31. Confirm @testing-library/react is installed (needed for hook tests)
cat node_modules/@testing-library/react/package.json 2>/dev/null | grep '"version"' || echo "TESTING LIBRARY NOT INSTALLED"
# If not installed: npm install -D @testing-library/react @testing-library/react-hooks
```

**Record all actual values.** Replace every placeholder in this plan with the real values found. If a file does NOT exist that the plan assumes does, flag it before proceeding.

**Critical Step 0 decisions that affect implementation:**

1. **Dashboard layout check (command #11):** If the `(dashboard)/layout.tsx` renders `<Sidebar />{children}` (sidebar OUTSIDE children), then a nested capture layout CANNOT strip the sidebar. In that case, you MUST use the `(capture)` route group approach described in Group 4. If the sidebar is rendered via a slot or is inside `children` somehow, the nested layout approach works.

2. **AI context builder check (command #5):** The existing function is `buildAIContext` from `@/lib/ai/context-builder.ts`. It returns `{ l1Context, l2Context, l3Context }` as stringified JSON. We create a NEW function `buildSessionCaptureContext` specifically for capture suggestions — see Group 3.

3. **AI config profile check (command #16):** If `getAIConfig` does NOT already have a `'suggestions'` profile, you MUST add one. See Group 3 for the exact profile definition. The `'suggestions'` profile must use Haiku for speed (< 2s response time is critical during live capture).

4. **Middleware matcher check (command #17):** If the Clerk middleware matcher does NOT include `/capture(.*)` or a wildcard that covers it, you MUST update `src/middleware.ts` in Group 4. This is a **blocking auth issue** — without it, unauthenticated users can access the capture page. See Group 4 for the exact fix.

5. **Open questions API check (command #10):** If no open questions API endpoint or query function exists, the system picker's auto-question feature (Group 4, component #5) must be **skipped entirely** — add a `// TODO: Phase 5.1 — auto-create open question after SYSTEM event` comment instead of implementing a broken call. Do NOT block the system picker on this.

6. **Timestamp column type check (command #18):** The `eventLogs.timestamp` column must accept `new Date(isoString)`. If the column is `text` type in Drizzle, you'll need to pass `.toISOString()` instead of `new Date()`. If it's `timestamp()` or `timestamp({ withTimezone: true })`, `new Date()` works directly. Record the actual type and adjust `createEvent` / `createEventsBatch` in Group 2 accordingly.

7. **Root layout ClerkProvider check (command #19):** The `(capture)` route group relies on `ClerkProvider` being in the root `app/layout.tsx`. If it's NOT there (e.g., it's only in `(dashboard)/layout.tsx`), you must add `<ClerkProvider>` to the `(capture)/layout.tsx`. See Group 4.

8. **Session PATCH route body check (command #6 + #21 + #22):** The post-capture screen PATCHes with `{ transcriptText, notes, status, durationMinutes }`. You MUST confirm that:
   - The sessions table has columns for `transcriptText`, `notes`, and `durationMinutes` (command #21).
   - The session PATCH route accepts and persists ALL these fields (command #6).
   - The session update Zod schema (if any) includes these fields (command #22).
   
   **If any field is missing from the PATCH route's accepted fields**, you must add it before Group 6. This is a data-loss bug — the user enters transcript and notes, clicks save, and the data silently disappears.

9. **`parseJSON` utility check (command #4):** If `parseJSON` is NOT exported from `src/lib/api/utils.ts`, replace all `parseJSON(req)` calls in this plan with `req.json()`. The API routes will still work — `parseJSON` is a convenience wrapper. Do NOT create a new `parseJSON` function just for this phase.

10. **`getProcessById` check (command #15):** The capture page (`page.tsx`) imports `getProcessById`. If this function does NOT exist but `getProcessWithModel` does, use `getProcessWithModel` instead — it returns a superset of data. If NEITHER exists, flag and stop.

11. **Soft delete pattern check (command #23 + #24):** If the `eventLogs` table has a `deletedAt` column, ALL query functions in Group 2 that read events (`listEventsBySession`, `countEventsBySession`) MUST add a `.where(isNull(eventLogs.deletedAt))` filter. Command #24 shows how existing queries implement this pattern — follow the same style. If `eventLogs` does NOT have `deletedAt`, no filter is needed.

12. **Vercel AI SDK check (command #25):** The suggestions route uses `generateObject` from the `ai` package (Vercel AI SDK v3+). You MUST confirm:
    - The `ai` package is in `package.json` dependencies.
    - The installed version supports `generateObject` with a `schema` parameter (v3+ API).
    - If the SDK is v2 or uses a different API (e.g., `experimental_generateObject`), adjust the import and call signature in Group 3.
    - If the SDK is NOT installed at all, install it: `npm install ai` and flag the model provider setup (e.g., `@ai-sdk/anthropic`).

13. **Drizzle pgEnum `enumValues` type shape (command #26):** Drizzle's `pgEnum(...).enumValues` returns `readonly [string, ...string[]]`. Zod's `z.enum()` requires a **mutable** tuple `[string, ...string[]]`. If a direct `z.enum(EVENT_TYPES)` causes a type error, you need a cast: `z.enum(EVENT_TYPES as unknown as [string, ...string[]])`. See Group 1 for the exact fix with `EVENT_TYPES_MUTABLE`. This is a **compile-time issue** — it won't fail at runtime but will block `tsc` and IDE type checking.

14. **Session `type` column check (command #27):** The capture page checks `session.type !== 'shadowing'` to reject non-shadowing sessions. You MUST confirm:
    - The sessions table has a `type` column (not just a `status` column).
    - The column accepts `'shadowing'` as a value.
    - If no `type` column exists, the capture page guard must be adjusted or removed. **This is a blocker** — if `session.type` is `undefined`, the `notFound()` call executes unconditionally and no session can ever be captured. Flag and stop if `type` doesn't exist.

15. **Session detail route path check (command #28):** The post-capture `onContinue` navigates to `/clients/${clientId}/processes/${processId}/sessions/${sessionId}`. You MUST confirm this exact route path exists under `src/app/(dashboard)/`. If the actual route uses a different nesting (e.g., `/sessions/${sessionId}` flat, or different param names), update the `window.location.href` path in Group 6. **If you get this wrong**, the user clicks "Guardar y Continuar" and lands on a 404.

16. **Org-scoping authorization pattern check (command #29):** The events API routes authenticate (requireAdmin/requireUserId) but do NOT verify the sessionId belongs to the caller's organization. Command #29 reveals the existing org-scoping pattern. **If the codebase already uses org-scoping in session queries** (e.g., `getSessionById` filters by orgId), then events are implicitly scoped because we look up the session first. **If NOT**, document this as a Known Limitation and add a `// TODO: Phase 6 — add org-scoping to event reads` comment.

17. **Drizzle ORM version check (command #30):** The `sql<number>` generic in `countEventsBySession` requires Drizzle ORM v0.28+. If you're on an older version, the `sql<number>` generic may not infer correctly. Verify the version. If it's < v0.28, cast the result explicitly: `const count = Number(result?.count ?? 0)`.

18. **Testing library check (command #31):** The hook tests in Group 5 use `renderHook` from `@testing-library/react`. You MUST confirm:
    - `@testing-library/react` is installed (v14+ includes `renderHook` natively).
    - If you're on v13 or lower, `renderHook` is in `@testing-library/react-hooks` instead — install it and update imports.
    - If NEITHER is installed, run `npm install -D @testing-library/react` before implementing Group 5 tests.

---

## Implementation Groups (6 groups, ordered by dependency)

### Group 1: Event Type Constants + UI Config

**Why first:** All groups depend on the event type configuration system.

**MODIFY:**

`src/lib/db/schema.ts`:
- Keep `eventTypeEnum` exactly as-is.
- Add application-level constants below the enum declaration:

```typescript
// Application-level event type constants.
// Derived from eventTypeEnum values for type-safe iteration and validation.
// If you need to add new types in the future, add them to eventTypeEnum AND here.
export const EVENT_TYPES = eventTypeEnum.enumValues;
export type EventType = (typeof EVENT_TYPES)[number];

// Mutable copy for use with z.enum() which requires a mutable tuple.
// Drizzle's enumValues is readonly; Zod rejects readonly tuples at the type level.
// NOTE: This cast widens the type from readonly ['STEP', 'EDGE', ...] to [string, ...string[]].
// Zod validation still works correctly at runtime (it checks against the actual string values),
// but z.infer<> will produce `string` instead of the union 'STEP' | 'EDGE' | ... for the type field.
// This is acceptable — we use the EventType alias for type narrowing in application code.
export const EVENT_TYPES_MUTABLE = [...EVENT_TYPES] as [string, ...string[]];
```

> **Why derive from the enum?** `eventTypeEnum.enumValues` returns the array `['STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION']` at runtime. By deriving `EVENT_TYPES` from it, we guarantee the constant and the DB enum are always in sync. If someone adds a value to the pgEnum, it automatically appears in `EVENT_TYPES`.

**CREATE:**

`src/lib/capture/event-types.ts` — UI configuration. Single source of truth for button rendering:

```typescript
import type { EventType } from '@/lib/db/schema';

export interface EventTypeConfig {
  id: EventType;
  label: string;           // Display label (Spanish per mockup)
  color: string;           // Tailwind color class stem (e.g. 'emerald' → bg-emerald-600)
  dotColor: string;        // Tailwind class for the event log dot
  shortcutKey?: string;    // Future: keyboard shortcut
  behavior: 'input_panel' | 'system_picker' | 'instant_log';
}

export const EVENT_TYPE_CONFIG: EventTypeConfig[] = [
  {
    id: 'STEP',
    label: 'Proceso',
    color: 'emerald',
    dotColor: 'bg-emerald-500',
    shortcutKey: 's',
    behavior: 'input_panel',
  },
  {
    id: 'EDGE',
    label: 'Edge Case',
    color: 'amber',
    dotColor: 'bg-amber-500',
    shortcutKey: 'e',
    behavior: 'input_panel',
  },
  {
    id: 'SYSTEM',
    label: 'Sistema',
    color: 'violet',
    dotColor: 'bg-violet-500',
    shortcutKey: 'y',
    behavior: 'system_picker',
  },
  {
    id: 'IMPLICIT',
    label: 'Implícito',
    color: 'red',
    dotColor: 'bg-red-500',
    shortcutKey: 'i',
    behavior: 'instant_log',
  },
  {
    id: 'QUESTION',
    label: 'Pregunta',
    color: 'blue',
    dotColor: 'bg-blue-500',
    shortcutKey: 'q',
    behavior: 'instant_log',
  },
];

// Default system options for the system picker.
// These are generic — a future enhancement could make them configurable
// per client or process type (see Known Limitation #6).
export const DEFAULT_SYSTEM_OPTIONS = [
  'Email', 'Excel', 'SharePoint', 'SAP', 'ERP', 'Browser', 'Phone', 'Otro',
] as const;

export function getEventTypeConfig(type: EventType): EventTypeConfig {
  const config = EVENT_TYPE_CONFIG.find((c) => c.id === type);
  if (!config) throw new Error(`Unknown event type: ${type}`);
  return config;
}
```

**CREATE:**

`src/__tests__/unit/capture/event-types.test.ts` (~6 tests):

```typescript
import { describe, it, expect } from 'vitest';
import { EVENT_TYPE_CONFIG, getEventTypeConfig, DEFAULT_SYSTEM_OPTIONS } from '@/lib/capture/event-types';
import { EVENT_TYPES } from '@/lib/db/schema';

describe('Event Type Config', () => {
  it('EVENT_TYPES constant has exactly 5 values', () => {
    expect(EVENT_TYPES).toEqual(['STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION']);
  });

  it('has a config entry for every EVENT_TYPE', () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_TYPE_CONFIG.find((c) => c.id === type)).toBeDefined();
    }
  });

  it('every config entry has required fields', () => {
    for (const config of EVENT_TYPE_CONFIG) {
      expect(config.id).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.dotColor).toBeTruthy();
      expect(config.behavior).toMatch(/^(input_panel|system_picker|instant_log)$/);
    }
  });

  it('getEventTypeConfig returns correct config', () => {
    const step = getEventTypeConfig('STEP');
    expect(step.label).toBe('Proceso');
    expect(step.behavior).toBe('input_panel');
  });

  it('getEventTypeConfig throws for unknown type', () => {
    expect(() => getEventTypeConfig('INVALID' as any)).toThrow('Unknown event type');
  });

  it('DEFAULT_SYSTEM_OPTIONS has 8 entries including Otro', () => {
    expect(DEFAULT_SYSTEM_OPTIONS).toHaveLength(8);
    expect(DEFAULT_SYSTEM_OPTIONS).toContain('Otro');
  });
});
```

**No migration needed.** The schema already has the correct enum. We only add the exported constant and the UI config file.

**Verify:** `npx vitest run src/__tests__/unit/db src/__tests__/unit/capture` — all schema + event-type tests pass. Zero regressions.

---

### Group 2: Events API + Batch Endpoint

**Depends on:** Group 1 (EVENT_TYPES constant)

**CREATE:**

`src/lib/validations/event.ts` — Zod schemas for event creation:

```typescript
import { z } from 'zod';
import { EVENT_TYPES_MUTABLE } from '@/lib/db/schema';

// IMPORTANT: We use EVENT_TYPES_MUTABLE (a mutable copy) instead of EVENT_TYPES
// because Drizzle's enumValues returns readonly [string, ...string[]] and
// z.enum() requires a mutable [string, ...string[]] tuple at the type level.
// Step 0 command #26 confirms the Drizzle type shape.
// If EVENT_TYPES_MUTABLE is not exported from schema.ts, use this inline cast:
//   z.enum(EVENT_TYPES as unknown as [string, ...string[]])

export const createEventSchema = z.object({
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.enum(EVENT_TYPES_MUTABLE),
  label: z.string().max(500).nullable().optional(),
  detail: z.string().max(5000).nullable().optional(),
  suggestionUsed: z.boolean().default(false),
});

export const createEventBatchSchema = z.object({
  events: z.array(createEventSchema).min(1).max(50),
});

export const updateEventSchema = z.object({
  label: z.string().max(500).optional(),
  detail: z.string().max(5000).optional(),
}).refine((data) => data.label !== undefined || data.detail !== undefined, {
  message: 'At least one of label or detail must be provided',
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateEventBatchInput = z.infer<typeof createEventBatchSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
```

> **Why `updateEventSchema` accepts both `label` and `detail`?** IMPLICIT events need inline label editing, and QUESTION events need inline detail editing (the question text). A single PATCH endpoint that accepts either field (or both) is simpler than two separate endpoints. The `.refine()` ensures the caller provides at least one field — a PATCH with an empty body is a no-op bug.

**CREATE or MODIFY:**

`src/lib/db/queries/events.ts` — Query functions:

If this file exists (Step 0 command #2 confirms), add these functions. If not, create it:

```typescript
import { db } from '@/lib/db';
import { eventLogs } from '@/lib/db/schema';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import type { CreateEventInput, UpdateEventInput } from '@/lib/validations/event';

// IMPORTANT — Step 0 binding (command #18):
// If eventLogs.timestamp is text type, replace `new Date(data.timestamp)` with `data.timestamp`
// If eventLogs.timestamp is timestamp() or timestamp({ withTimezone: true }), `new Date()` is correct

// IMPORTANT — Step 0 binding (command #23 + #24):
// If eventLogs has a `deletedAt` column, the softDeleteFilter below is correct.
// If eventLogs does NOT have `deletedAt`, remove all `softDeleteFilter` references
// and the `isNull` import.
const softDeleteFilter = (sessionId: string) =>
  and(eq(eventLogs.sessionId, sessionId), isNull(eventLogs.deletedAt));
// ^ If eventLogs has no deletedAt column, replace with:
// const sessionFilter = (sessionId: string) => eq(eventLogs.sessionId, sessionId);
// and use sessionFilter everywhere softDeleteFilter is used below.

export async function createEvent(data: CreateEventInput) {
  const [event] = await db
    .insert(eventLogs)
    .values({
      sessionId: data.sessionId,
      timestamp: new Date(data.timestamp),
      type: data.type,
      label: data.label ?? null,
      detail: data.detail ?? null,
      suggestionUsed: data.suggestionUsed ?? false,
    })
    .returning();
  return event;
}

export async function createEventsBatch(events: CreateEventInput[]) {
  // Single INSERT statement = atomic
  const rows = await db
    .insert(eventLogs)
    .values(
      events.map((e) => ({
        sessionId: e.sessionId,
        timestamp: new Date(e.timestamp),
        type: e.type,
        label: e.label ?? null,
        detail: e.detail ?? null,
        suggestionUsed: e.suggestionUsed ?? false,
      }))
    )
    .returning();
  return rows;
}

export async function listEventsBySession(sessionId: string) {
  // Step 0 binding (command #23): If eventLogs has deletedAt, softDeleteFilter
  // excludes soft-deleted events. If no deletedAt column, use eq(eventLogs.sessionId, sessionId).
  return db
    .select()
    .from(eventLogs)
    .where(softDeleteFilter(sessionId))
    .orderBy(asc(eventLogs.timestamp));
}

export async function updateEvent(eventId: string, data: UpdateEventInput) {
  // Build the SET clause dynamically — only include fields that were provided.
  // This prevents overwriting a label with undefined when only detail was provided.
  const updates: Record<string, any> = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.detail !== undefined) updates.detail = data.detail;

  const [updated] = await db
    .update(eventLogs)
    .set(updates)
    .where(eq(eventLogs.id, eventId))
    .returning();
  return updated;
}

export async function countEventsBySession(sessionId: string) {
  // Step 0 binding (command #23): Same soft-delete filter as listEventsBySession.
  // Step 0 binding (command #30): If Drizzle < v0.28, cast: Number(result?.count ?? 0)
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventLogs)
    .where(softDeleteFilter(sessionId));
  return result?.count ?? 0;
}
```

> **Why `count(*)::int` instead of `listEventsBySession().length`?** Pulling all rows to count them is O(n) memory. `count(*)` is O(1) at the database level. During a busy capture session, hundreds of events accumulate — this matters.

**CREATE:**

`src/app/api/sessions/[sessionId]/events/route.ts` — Single event + list:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireUserId } from '@/lib/auth/utils';
import { handleAPIError } from '@/lib/api/utils';
import { createEventSchema } from '@/lib/validations/event';
import { createEvent, listEventsBySession } from '@/lib/db/queries/events';

// Step 0 binding (command #4): If parseJSON exists in @/lib/api/utils, import and use it.
// If it does NOT exist, use req.json() directly instead.

// Step 0 binding (command #29): Org-scoping check.
// If getSessionById already filters by orgId (confirm via command #29),
// events are implicitly scoped — the session lookup in the capture page
// prevents cross-org access. If NOT, add a // TODO comment (see Known Limitation #7).

// GET /api/sessions/[sessionId]/events
// Auth: any authenticated user can read events (needed for session detail view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireUserId();
    const { sessionId } = await params;
    const events = await listEventsBySession(sessionId);
    return NextResponse.json(events);
  } catch (error) {
    return handleAPIError(error);
  }
}

// POST /api/sessions/[sessionId]/events
// Auth: admin only (only FDEs create events during capture)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;
    const body = await req.json(); // Step 0: replace with parseJSON(req) if available
    const data = createEventSchema.parse({ ...body, sessionId });
    const event = await createEvent(data);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

> **Auth model rationale:** `GET` uses `requireUserId` — any authenticated user can view events (needed for session detail/debrief views). `POST`, `PATCH`, and batch use `requireAdmin` — only FDEs (admin role) create or modify events during capture. This matches the existing CRUD pattern for sessions. Org-scoping is checked via Step 0 command #29 — see critical decision #16.

**CREATE:**

`src/app/api/sessions/[sessionId]/events/batch/route.ts` — Batch endpoint for offline sync:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/utils';
import { handleAPIError } from '@/lib/api/utils';
import { createEventBatchSchema } from '@/lib/validations/event';
import { createEventsBatch } from '@/lib/db/queries/events';

// POST /api/sessions/[sessionId]/events/batch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await requireAdmin();
    const { sessionId } = await params;
    const body = await req.json(); // Step 0: replace with parseJSON(req) if available

    // Override sessionId from URL param for all events (security — prevents
    // a crafted request from inserting events into a different session)
    const eventsWithSessionId = (body.events ?? []).map((e: any) => ({
      ...e,
      sessionId,
    }));

    const data = createEventBatchSchema.parse({ events: eventsWithSessionId });
    const events = await createEventsBatch(data.events);
    return NextResponse.json({ created: events.length, events }, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**CREATE:**

`src/app/api/sessions/[sessionId]/events/[eventId]/route.ts` — Update event (label and/or detail for inline editing):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/utils';
import { handleAPIError } from '@/lib/api/utils';
import { updateEventSchema } from '@/lib/validations/event';
import { updateEvent } from '@/lib/db/queries/events';

// PATCH /api/sessions/[sessionId]/events/[eventId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; eventId: string }> }
) {
  try {
    await requireAdmin();
    const { eventId } = await params;
    const body = await req.json(); // Step 0: replace with parseJSON(req) if available
    const data = updateEventSchema.parse(body);
    const updated = await updateEvent(eventId, data);
    if (!updated) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleAPIError(error);
  }
}
```

**CREATE:**

`src/__tests__/api/events.test.ts` (~15 tests):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Use same mock patterns as src/__tests__/api/sessions*.test.ts (Step 0 confirms path)

// Step 0 binding (command #12): Import Clerk mock setup from confirmed path.
// Typically: vi.mock('@clerk/nextjs/server', () => ({ ... }));

describe('POST /api/sessions/[sessionId]/events', () => {
  it('creates a STEP event with label and returns 201', async () => {
    // Arrange: mock requireAdmin to resolve, mock createEvent to return event object
    // Act: call POST with { timestamp, type: 'STEP', label: 'Opens email client' }
    // Assert: response status 201, body has id, type 'STEP', label 'Opens email client'
  });

  it('creates an IMPLICIT event with null label', async () => {
    // Act: call POST with { timestamp, type: 'IMPLICIT', label: null }
    // Assert: status 201, label is null
  });

  it('creates a SYSTEM event with detail notes', async () => {
    // Act: call POST with { timestamp, type: 'SYSTEM', label: 'SAP', detail: 'Transaction VA01 - Create Sales Order' }
    // Assert: status 201, body has type 'SYSTEM', label 'SAP', detail 'Transaction VA01 - Create Sales Order'
    // IMPORTANT: This test verifies the `detail` field is persisted, not just `label`.
  });

  it('creates a QUESTION event with null detail', async () => {
    // Act: call POST with { timestamp, type: 'QUESTION', label: null, detail: null }
    // Assert: status 201, type 'QUESTION'
  });

  it('rejects invalid event type with 400', async () => {
    // Act: call POST with { type: 'INVALID_TYPE' }
    // Assert: status 400
  });

  it('rejects missing timestamp with 400', async () => {
    // Act: call POST with { type: 'STEP', label: 'test' } — no timestamp
    // Assert: status 400
  });

  it('rejects unauthenticated request with 401', async () => {
    // Arrange: mock requireAdmin to throw 401
    // Assert: status 401
  });

  it('rejects non-admin user with 403', async () => {
    // Arrange: mock requireAdmin to throw 403
    // Assert: status 403
  });
});

describe('GET /api/sessions/[sessionId]/events', () => {
  it('returns events ordered by timestamp ascending', async () => {
    // Arrange: mock listEventsBySession to return [event1, event2] already ordered
    // Assert: response is array, order matches
  });

  it('returns empty array for session with no events', async () => {
    // Arrange: mock listEventsBySession to return []
    // Assert: response is []
  });

  it('rejects unauthenticated request with 401', async () => {
    // Arrange: mock requireUserId to throw 401
    // Assert: status 401
  });
});

describe('PATCH /api/sessions/[sessionId]/events/[eventId]', () => {
  it('updates event label only and returns updated event', async () => {
    // Arrange: mock updateEvent to return updated event
    // Act: call PATCH with { label: 'New label text' }
    // Assert: status 200, body has updated label
  });

  it('updates event detail only and returns updated event', async () => {
    // Arrange: mock updateEvent to return updated event with new detail
    // Act: call PATCH with { detail: '¿Por qué usan Excel en vez de SAP?' }
    // Assert: status 200, body has updated detail
  });

  it('rejects PATCH with empty body (no label or detail)', async () => {
    // Act: call PATCH with {}
    // Assert: status 400 (Zod refine fails: "At least one of label or detail must be provided")
  });

  it('returns 404 for non-existent event', async () => {
    // Arrange: mock updateEvent to return undefined
    // Assert: status 404
  });
});
```

**CREATE:**

`src/__tests__/api/events-batch.test.ts` (~8 tests):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Same mock setup as events.test.ts

describe('POST /api/sessions/[sessionId]/events/batch', () => {
  it('creates multiple events atomically and returns 201', async () => {
    // Arrange: mock createEventsBatch to return 3 events
    // Act: POST with { events: [event1, event2, event3] }
    // Assert: status 201, body.created === 3, body.events has length 3
  });

  it('overrides sessionId from URL param for all events (security)', async () => {
    // CRITICAL SECURITY TEST — verifies that a malicious client cannot inject
    // events into a different session by providing a different sessionId in the body.
    //
    // Arrange: mock requireAdmin, mock createEventsBatch to capture received args
    // Act: POST to /api/sessions/REAL_SESSION_ID/events/batch with body:
    //   { events: [
    //     { sessionId: 'ATTACKER_SESSION_ID', type: 'STEP', timestamp: '...', label: 'x' },
    //     { sessionId: 'ANOTHER_FAKE_ID', type: 'EDGE', timestamp: '...', label: 'y' },
    //   ]}
    // Assert: createEventsBatch was called with events where ALL sessionId === 'REAL_SESSION_ID'
    //   NOT 'ATTACKER_SESSION_ID' or 'ANOTHER_FAKE_ID'
    //
    // Implementation pattern:
    // const capturedArgs = vi.fn();
    // vi.mocked(createEventsBatch).mockImplementation(async (events) => {
    //   capturedArgs(events);
    //   return events.map((e, i) => ({ ...e, id: `server-${i}` }));
    // });
    // ... make request ...
    // const passedEvents = capturedArgs.mock.calls[0][0];
    // for (const event of passedEvents) {
    //   expect(event.sessionId).toBe('REAL_SESSION_ID');
    // }
  });

  it('rejects empty events array with 400', async () => {
    // Act: POST with { events: [] }
    // Assert: status 400 (Zod min(1) validation fails)
  });

  it('rejects batch exceeding 50 events with 400', async () => {
    // Act: POST with { events: Array(51).fill(validEvent) }
    // Assert: status 400 (Zod max(50) validation fails)
  });

  it('rejects if any event has invalid type with 400', async () => {
    // Act: POST with { events: [validEvent, { ...validEvent, type: 'BOGUS' }] }
    // Assert: status 400
  });

  it('rejects unauthenticated request with 401', async () => {
    // Arrange: mock requireAdmin to throw 401
    // Assert: status 401
  });

  it('rejects non-admin user with 403', async () => {
    // Arrange: mock requireAdmin to throw 403
    // Assert: status 403
  });

  it('returns created count and events array in insertion order', async () => {
    // Arrange: mock createEventsBatch to return events with server IDs
    // Act: POST with { events: [eventA, eventB] }
    // Assert: body.created === 2, body.events[0] corresponds to eventA, body.events[1] to eventB
  });
});
```

**Verify:** `npx vitest run src/__tests__/api/events` — ~23 tests pass.

---

### Group 3: Suggestions AI Route (parallel with Group 2)

**Depends on:** Group 1 (EVENT_TYPES), existing AI infrastructure from Phases 3/4.

**IMPORTANT — Three prerequisite checks before implementation:**

1. **Context builder gap:** The existing `buildAIContext` function (from `@/lib/ai/context-builder.ts`) returns `{ l1Context, l2Context, l3Context }` as **stringified JSON strings**. The suggestions route needs structured data (recentEvents array, processModelSteps array, etc.). We create a **new** dedicated context function for capture.

2. **AI config profile check (Step 0 command #16):** If `getAIConfig` does NOT already accept `'suggestions'` as a profile key, you MUST add the profile. Open `src/lib/ai/get-ai-config.ts` and add the `'suggestions'` case mapping to the Haiku model with these settings:
   - Model: `claude-haiku` (or whatever the existing Haiku reference is in the file — match the pattern)
   - Temperature: `0.7` (creative enough for varied suggestions, not so high it hallucinates)
   - Max tokens: `500`
   
   If `getAIConfig` uses a config object/map pattern, add:
   ```typescript
   suggestions: { model: 'haiku', temperature: 0.7 },  // Adapt to actual pattern in file
   ```
   If it uses a switch/case, add the `'suggestions'` case returning Haiku. **Match the existing code style exactly.**

3. **Vercel AI SDK check (Step 0 command #25):** The suggestions route uses `generateObject` from the `ai` package. You MUST confirm:
   - The `ai` package is listed in `package.json` dependencies.
   - The installed version exports `generateObject` (v3+ API). Check: `grep -rn "generateObject" node_modules/ai/dist/index.d.ts 2>/dev/null`.
   - If the SDK uses `experimental_generateObject` (v2 API), rename the import accordingly.
   - If the SDK is NOT installed, run `npm install ai @ai-sdk/anthropic` and configure the Anthropic provider in `get-ai-config.ts`.

**CREATE:**

`src/lib/ai/schemas/suggestions.ts`:

```typescript
import { z } from 'zod';

export const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      text: z.string().max(100),
      rationale: z.string().max(200),
    })
  ).max(5),
});

export type SuggestionsOutput = z.infer<typeof suggestionsSchema>;
```

> **Why objects instead of plain strings?** The `rationale` field is not shown in the UI during capture (too slow to read), but it is logged for post-hoc evaluation of suggestion quality.

**CREATE:**

`src/lib/ai/context/capture-context.ts` — Dedicated context builder for capture suggestions:

```typescript
import { getSessionById } from '@/lib/db/queries/sessions';
import { listEventsBySession } from '@/lib/db/queries/events';
// Step 0 binding (command #15): Use getProcessWithModel if it exists.
// If only getProcessById exists, use that. If getProcessById does NOT
// return a processModel field, processModelSteps will be empty — that's OK,
// suggestions will be generic. There is no separate processModel query to fall back to.
import { getProcessWithModel } from '@/lib/db/queries/processes';
// Step 0 binding (command #14): Confirm getL1 path:
import { getL1 } from '@/lib/domain/l1';

export interface CaptureContext {
  processTypeL1: string | null;
  l1Library: any | null;
  recentEvents: Array<{
    type: string;
    label: string | null;
    timestamp: string;
  }>;
  processModelSteps: Array<{
    name: string;
    description: string;
    confidence: string;
  }>;
  interviewAnswers: any;
}

/**
 * Build structured context for capture suggestions.
 * Unlike buildAIContext (which returns stringified JSON),
 * this returns typed objects for use in prompt construction.
 */
export async function buildCaptureContext(sessionId: string): Promise<CaptureContext> {
  const session = await getSessionById(sessionId);
  if (!session) {
    return {
      processTypeL1: null,
      l1Library: null,
      recentEvents: [],
      processModelSteps: [],
      interviewAnswers: null,
    };
  }

  // Step 0 binding (command #15): confirm getProcessWithModel exists and returns .processModel
  // If it doesn't exist, use getProcessById instead.
  // If NEITHER exists, flag and stop (critical decision #10).
  const process = await getProcessWithModel(session.processId);

  let l1Library = null;
  if (process?.processTypeL1) {
    try {
      l1Library = getL1(process.processTypeL1);
    } catch {
      // L1 not found for this process type — suggestions will be generic
    }
  }

  // Get events already logged in this session (from DB, not from client state)
  const dbEvents = await listEventsBySession(sessionId);
  const recentEvents = dbEvents.slice(-20).map((e) => ({
    type: e.type,
    label: e.label,
    // Step 0 binding (command #18): timestamp column type determines this guard.
    // If timestamp() → Drizzle returns Date → .toISOString() works.
    // If text → Drizzle returns string → calling .toISOString() would crash.
    // The instanceof guard handles both cases safely.
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp),
  }));

  // Extract steps from ProcessModel JSONB
  // Step 0 binding (command #15): If getProcessById is used instead of getProcessWithModel,
  // check whether process has a processModel field. If not, steps will be [].
  const steps = (process?.processModel?.steps ?? []) as Array<{
    name: string;
    description: string;
    confidence: string;
  }>;

  return {
    processTypeL1: process?.processTypeL1 ?? null,
    l1Library,
    recentEvents,
    processModelSteps: steps,
    interviewAnswers: session.interviewAnswers,
  };
}
```

> **Why a separate function?** `buildAIContext` is designed for general AI calls (synthesis, interview, prep brief) and returns stringified context layers. Capture suggestions need structured arrays for prompt interpolation. Duplicating a few queries is better than shoe-horning the existing function and breaking its contract.

**CREATE:**

`src/lib/ai/prompts/capture-suggestions.ts`:

```typescript
import type { CaptureContext } from '@/lib/ai/context/capture-context';

export function buildCapturePrompt(ctx: CaptureContext, activeType: 'STEP' | 'EDGE'): string {
  const typeLabel = activeType === 'STEP' ? 'process steps' : 'edge cases';

  return `You are assisting an FDE (Forward Deployed Engineer) during a live shadowing session.
They are observing someone perform a real business process and need quick suggestions for ${typeLabel} to log.

Process type: ${ctx.processTypeL1 ?? 'unknown'}

Current process model steps:
${ctx.processModelSteps.map((s) => `- ${s.name} (${s.confidence}): ${s.description}`).join('\n') || '(no steps yet)'}

Events logged so far this session (most recent last):
${ctx.recentEvents.map((e) => `[${e.type}] ${e.label ?? '(no label)'}`).join('\n') || '(none yet)'}

${ctx.l1Library ? `Domain knowledge:\n${JSON.stringify(ctx.l1Library, null, 2)}` : ''}

Generate 3-5 short suggestions for the NEXT likely ${typeLabel} the FDE might observe.
Each suggestion should be 3-8 words — short enough to tap quickly on a tablet.
Base suggestions on: what typically comes next in this process type, what hasn't been logged yet, and the domain patterns.

Return suggestions ranked by likelihood (most likely first).`;
}
```

**CREATE:**

`src/app/api/ai/suggestions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/utils';
import { handleAPIError } from '@/lib/api/utils';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { generateObject } from 'ai';
// Step 0 binding (command #25): If SDK v2, use:
//   import { experimental_generateObject as generateObject } from 'ai';
import { suggestionsSchema } from '@/lib/ai/schemas/suggestions';
import { buildCapturePrompt } from '@/lib/ai/prompts/capture-suggestions';
import { buildCaptureContext } from '@/lib/ai/context/capture-context';

// In-memory cache: key = `${sessionId}:${activeType}:${eventCount}`, TTL = 30s
// NOTE: On Vercel serverless, each invocation may cold-start a new process.
// This cache only helps when the same worker instance handles multiple requests
// within 30s (warm invocations). Cache hit rate will be low on serverless
// but provides value in development and on long-running servers.
const cache = new Map<string, { data: any; expiry: number }>();

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiry: Date.now() + 30_000 });
  // Evict old entries (keep cache small — FIFO eviction)
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

// POST /api/ai/suggestions
export async function POST(req: NextRequest) {
  try {
    await requireUserId();
    const body = await req.json(); // Step 0: replace with parseJSON(req) if available
    const { sessionId, activeType, eventCount } = body;

    if (!sessionId || !activeType) {
      return NextResponse.json({ suggestions: [] });
    }

    // Only STEP and EDGE get suggestions — others don't need them
    if (activeType !== 'STEP' && activeType !== 'EDGE') {
      return NextResponse.json({ suggestions: [] });
    }

    // Check cache (key includes activeType to prevent cross-type stale hits)
    const cacheKey = `${sessionId}:${activeType}:${eventCount ?? 0}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const aiConfig = await getAIConfig('suggestions'); // Step 0 command #16 confirms this exists
    const context = await buildCaptureContext(sessionId);

    const { object } = await generateObject({
      model: aiConfig.model,
      schema: suggestionsSchema,
      prompt: buildCapturePrompt(context, activeType),
      maxTokens: 500,
    });

    const result = { suggestions: object.suggestions };
    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    // NEVER return 500 from suggestions — capture UI must not break
    console.error('Suggestions error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
```

> **Critical design decision:** This route NEVER returns a 500 error. Any failure (no API key, rate limit, timeout, malformed response) results in `{ suggestions: [] }`. The capture UI must never break because of AI failures.

**CREATE:**

`src/__tests__/api/ai-suggestions.test.ts` (~9 tests):

```typescript
describe('POST /api/ai/suggestions', () => {
  it('returns suggestions array on success', async () => { /* ... */ });
  it('returns cached result within 30s TTL', async () => { /* ... */ });
  it('returns fresh result after cache expires', async () => { /* ... */ });
  it('returns empty array when sessionId missing', async () => { /* ... */ });
  it('returns empty array when AI call fails (no 500)', async () => { /* ... */ });
  it('returns empty array when no API key configured (no 500)', async () => { /* ... */ });
  it('returns empty array for non-STEP/EDGE activeType', async () => { /* ... */ });
  it('limits suggestions to max 5', async () => { /* ... */ });
  it('rejects unauthenticated request', async () => { /* ... */ });
});
```

**Verify:** `npx vitest run src/__tests__/api/ai-suggestions` — ~9 tests pass.

---

### Group 4: Capture Page + UI Components (Hybrid Layout)

**Depends on:** Groups 2 (events API), 3 (suggestions API)

**Built together with:** Group 5 (offline sync hook — Group 4 components consume the hook)

#### Layout (matching user's mockup)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Shadowing Session"  │  Timer (MM:SS)  │  End Btn  │
│                              │                 │  [offline] │
├─────────────────────────────────────────────────────────────┤
│ [Text input for observation label]              [Enter ⏎]  │
├─────────────────────────────────────────────────────────────┤
│ [Proceso][Edge Case][Sistema][Implícito][Pregunta]          │
│                                     horizontal buttons      │
├─────────────────────────────────────────────────────────────┤
│ [Suggestion chips — only when STEP or EDGE is active]       │
├───────────────────────────────────┬─────────────────────────┤
│ Event Log (timestamped, color-coded)  │ Analytics Sidebar   │
│ auto-scroll to bottom                 │ - Total events      │
│                                       │ - Per-hour rate     │
│ IMPLICIT: inline label editor         │ - Type frequency    │
│ QUESTION: inline text editor          │     bars            │
│                                       │                     │
└───────────────────────────────────┴─────────────────────────┘
```

#### Pre-requisite: Clerk middleware update

**Step 0 command #17 determines if this is needed.** If the Clerk middleware matcher in `src/middleware.ts` does NOT already cover `/capture(.*)`, you MUST update it:

**MODIFY `src/middleware.ts`:**

Find the `matcher` config (typically in `export const config = { matcher: [...] }`) and add the capture route pattern. For example, if the current matcher is:

```typescript
export const config = {
  matcher: ['/(dashboard)(.*)', '/api(.*)'],
};
```

Add the capture pattern:

```typescript
export const config = {
  matcher: ['/(dashboard)(.*)', '/(capture)(.*)', '/api(.*)'],
};
```

> **Why this is blocking, not optional:** Without middleware protection, `/capture/[sessionId]` is publicly accessible. An unauthenticated user could navigate to a capture URL and see the session title, process name, and potentially event data. This is a **security bug**, not a "known limitation".

**If the middleware uses a different pattern (e.g., `/((?!_next|api|static).*)`)** that already catches all routes, no change is needed. Step 0 command #17 confirms this.

#### Capture page routing — `(capture)` route group

**IMPORTANT:** The standard shadcn `(dashboard)/layout.tsx` renders the sidebar alongside `{children}`:

```tsx
// Typical (dashboard)/layout.tsx structure
export default function DashboardLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />        {/* ← rendered OUTSIDE children */}
      <main>{children}</main>
    </div>
  );
}
```

A nested layout inside `(dashboard)` that just renders `{children}` does NOT remove the parent sidebar — Next.js layouts compose, they don't replace. **Therefore, the capture page MUST use its own route group.**

> **Step 0 validation:** If command #11 reveals the sidebar is rendered as a slot or inside `{children}` (unlikely with standard shadcn), then the nested layout approach could work. But plan for `(capture)` by default.

**CREATE:**

`src/app/(capture)/layout.tsx`:

```typescript
// Step 0 command #19: If ClerkProvider is in app/layout.tsx (root), this is sufficient.
// If ClerkProvider is NOT in root layout, add: import { ClerkProvider } from '@clerk/nextjs';
// and wrap children in <ClerkProvider>{children}</ClerkProvider>

// Minimal layout — no sidebar, no breadcrumb, no header
// Only provides auth context (ClerkProvider is required for requireAdmin/requireUserId)
export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

> **Why does this work?** Next.js route groups `(dashboard)` and `(capture)` are siblings — a page in `(capture)` never sees the `(dashboard)/layout.tsx`. But both share `app/layout.tsx` (root layout) which wraps in `<ClerkProvider>`. If `ClerkProvider` is in the root layout (Step 0 command #19 confirms), this nested layout doesn't need to re-add it. If not, add it here.

**CREATE:**

`src/app/(capture)/capture/[sessionId]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getSessionById } from '@/lib/db/queries/sessions';
import { CaptureView } from '@/components/capture/capture-view';

// Step 0 binding (command #15):
// If getProcessById exists, import it. If only getProcessWithModel exists, use that instead.
// getProcessWithModel returns a superset — either works.
import { getProcessById } from '@/lib/db/queries/processes';

export default async function CapturePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) notFound();

  // Step 0 binding (command #27): Confirm sessions table has a 'type' column.
  // If session.type does NOT exist (field is undefined), REMOVE this guard entirely.
  // Without it, ALL sessions would 404 because `undefined !== 'shadowing'` is always true.
  // If session.type exists, keep this guard — it prevents interview sessions from being captured.
  if (session.type !== 'shadowing') notFound();

  const process = await getProcessById(session.processId);
  if (!process) notFound();

  // Derive clientId from the process (which has clientId)
  const clientId = process.clientId;

  return (
    <CaptureView
      sessionId={sessionId}
      clientId={clientId}
      processId={process.id}
      sessionTitle={session.title}
      processName={process.name}
    />
  );
}
```

> **Route path:** `/capture/[sessionId]` — simpler than the deeply nested dashboard path. The session ID is sufficient to look up all related entities. The "Start Capture" button in the session detail page links to `/capture/[sessionId]`.

**CREATE (10 component files):**

1. `src/components/capture/capture-view.tsx` — Client orchestrator:

State machine: `capturing` → `post-capture`

```
- capturing: Full capture UI visible. On mount, sets session status to 'in_progress' via PATCH.
              Events being logged. If PATCH fails, console.error but do NOT block capture.
- post-capture: Shows transcript/notes form after End Session confirmed.
```

> **Why no `idle` state?** The mount PATCH to set `in_progress` is fire-and-forget. The user should see the capture UI immediately — waiting for the PATCH response adds latency for no benefit. If the PATCH fails (network issue), the capture still works locally and the status will be corrected on End Session.

Key responsibilities:
- Calls `PATCH /api/sessions/[sessionId]` with `{ status: 'in_progress' }` on mount (fire-and-forget, error logged but not blocking)
- Manages `selectedType` (which button is active, `EventType | null`)
- Manages `inputValue` (text field content)
- Consumes `useEventSync` hook (Group 5) for event queue
- Consumes `useSuggestions` hook for AI chips
- Tracks `startTime` (Date.now() on mount) for timer display
- **Captures `endTime` via `useRef` at the moment of End Session confirmation** — used for accurate `durationMinutes` calculation in post-capture. Do NOT calculate duration at render time; use `(endTimeRef.current - startTime) / 60_000` when transitioning to `post-capture`.
- On End Session confirmed: sets `endTimeRef.current = Date.now()`, calls `flushAll()` in a try/catch, transitions to post-capture on success OR shows error toast on failure
- Manages `flushError` state for error feedback when `flushAll` fails
- Passes `flushError` to `capture-header.tsx` as a prop for display
- Fixed `inset-0 z-50` positioning — covers entire viewport

**Critical implementation detail — `durationMinutes` accuracy:**

```typescript
const [startTime] = useState(() => Date.now());
const endTimeRef = useRef<number>(0);

async function handleEndSession() {
  // Capture the exact end time BEFORE awaiting flushAll.
  // If we calculated (Date.now() - startTime) at render time in post-capture,
  // the duration would drift upward while the user fills in transcript/notes.
  endTimeRef.current = Date.now();
  await flushAll();
  setMode('post-capture');
}

// In the post-capture render:
const durationMinutes = (endTimeRef.current - startTime) / 60_000;
```

**Critical implementation detail — `flushAll` error handling:**

```typescript
const [flushError, setFlushError] = useState<string | null>(null);

async function handleEndSession() {
  endTimeRef.current = Date.now();
  setFlushError(null);
  try {
    await flushAll();
    setMode('post-capture');
  } catch (err) {
    // flushAll failed — events are still unsynced.
    // Do NOT transition to post-capture — user stays on capture screen.
    // The 3s sync interval will restart (flushAll's finally block handles this)
    // and will retry on the next tick.
    console.error('Failed to sync events on end session:', err);
    setFlushError(
      'No se pudieron sincronizar los eventos. Verifica tu conexión e intenta de nuevo.'
    );
    // Reset endTimeRef so next attempt recalculates
    endTimeRef.current = 0;
  }
}

// Render the error inline above the "Terminar" button:
// {flushError && (
//   <p className="text-sm text-destructive">{flushError}</p>
// )}
```

> **Why not silently transition?** If events failed to sync, marking the session as `completed` without event data is a data integrity issue. Better to keep the user on the capture screen where the sync interval will retry, and give them a clear error message.

2. `src/components/capture/capture-header.tsx`:

Props interface:

```typescript
interface CaptureHeaderProps {
  sessionTitle: string;
  startTime: number;
  isOnline: boolean;
  flushError: string | null;
  unsyncedCount: number;
  eventCount: number;
  onEndSession: () => void;
}
```

- Session title (truncated with `truncate` class, max-width)
- Timer display (MM:SS, calculated from `startTime` via setInterval — use `useEffect` with 1s interval + state, NOT `Date.now()` on every render)
- Offline indicator (amber dot + "Sin conexión" text when `!isOnline`)
- Flush error message (red `text-destructive` text when `flushError` is set)
- "Terminar" (End Session) button — shadcn `Button` variant destructive, only visible after first event (`eventCount > 0`)
- Minimum height: 48px

> **Timer implementation detail:** The timer component should use a local `useEffect` + `useState`:
> ```typescript
> const [elapsed, setElapsed] = useState(0);
> useEffect(() => {
>   const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
>   return () => clearInterval(id);
> }, [startTime]);
> const minutes = Math.floor(elapsed / 60_000);
> const seconds = Math.floor((elapsed % 60_000) / 1000);
> ```
> Do NOT use `requestAnimationFrame` — 1s precision is sufficient for a session timer, and rAF wastes CPU on iPad.

3. `src/components/capture/event-type-bar.tsx`:

Horizontal row of 5 buttons rendered from `EVENT_TYPE_CONFIG`:
- Each button: `min-h-[48px]` for touch targets, color-coded left border, label text
- Active button gets filled background (`bg-{color}-100 border-{color}-600`)
- Clicking a button with `behavior: 'input_panel'` sets `selectedType` and focuses text input
- Clicking a button with `behavior: 'system_picker'` opens system picker popover
- Clicking a button with `behavior: 'instant_log'` immediately creates event + resets
- Buttons are always enabled — no disabled states during capture

> **Tailwind dynamic class note:** Tailwind purges classes not found in source at build time. Because `color` is a variable (e.g. `'emerald'`, `'amber'`), dynamic classes like `` `bg-${config.color}-100` `` will be purged. You MUST either:
> - (a) Add all used color combinations to `tailwind.config.ts` safelist: `safelist: ['bg-emerald-100', 'bg-emerald-600', 'bg-amber-100', ...]`
> - (b) Use a lookup map instead of string interpolation:
> ```typescript
> const COLOR_CLASSES: Record<string, { bg: string; border: string; activeBg: string }> = {
>   emerald: { bg: 'bg-emerald-600', border: 'border-emerald-600', activeBg: 'bg-emerald-100' },
>   amber: { bg: 'bg-amber-600', border: 'border-amber-600', activeBg: 'bg-amber-100' },
>   violet: { bg: 'bg-violet-600', border: 'border-violet-600', activeBg: 'bg-violet-100' },
>   red: { bg: 'bg-red-600', border: 'border-red-600', activeBg: 'bg-red-100' },
>   blue: { bg: 'bg-blue-600', border: 'border-blue-600', activeBg: 'bg-blue-100' },
> };
> ```
> Option (b) is preferred — it's explicit, type-safe, and doesn't require safelist config.

4. `src/components/capture/observation-input.tsx`:

Text input field for STEP and EDGE labels:
- Visible when `selectedType` is STEP or EDGE
- Auto-focused when type selected (via `useEffect` + `inputRef.current?.focus()` when `selectedType` changes)
- Enter key submits: creates event with typed label
- Escape key cancels (deselects type)
- Placeholder changes per type: "Describe el paso observado..." / "Describe el edge case..."
- Clears after submission

5. `src/components/capture/system-picker.tsx`:

8-button grid popover for SYSTEM events:
- Grid layout: 2 columns × 4 rows
- Options rendered from `DEFAULT_SYSTEM_OPTIONS` (imported from `event-types.ts`)
- "Otro" reveals a text input for custom system name
- Below the grid: optional `<Textarea>` for detail notes (e.g., "Sheet: Quotes2024, Col A = Supplier Name")
- On system selection: creates event with `type: 'SYSTEM'`, `label: systemName`, `detail: detailNotes`
- **Auto-creates open question (CONDITIONAL — depends on Step 0 command #10):**
  - **If open questions API exists:** After logging a SYSTEM event, POST to the open questions API endpoint with `{ text: "Confirmar rol de [System] en este proceso — carpetas, columnas o campos relevantes.", priority: 'important', status: 'open' }`. If this call fails, log a console error but do NOT block the event creation.
  - **If open questions API does NOT exist:** Skip this entirely. Add a `// TODO: Phase 5.1 — auto-create open question after SYSTEM event (blocked: no open questions API)` comment in the handler and move on. Do NOT create a non-functional API call.
- Dismiss by clicking outside or pressing Escape

6. `src/components/capture/suggestion-chips.tsx`:

Horizontal scrollable row of suggestion chips:
- Only visible when `selectedType` is STEP or EDGE
- Shows shimmer loading state for max 1.5s, then falls back to empty (text input always available)
- Each chip: rounded pill, tappable, shows suggestion text
- Tap chip → creates event with `suggestionUsed: true` and chip text as label
- Horizontal scroll with `overflow-x-auto`, `flex-nowrap`, `gap-2`
- Chips are min-width `max-content` to prevent text wrapping

7. `src/components/capture/event-log-panel.tsx`:

Scrollable event list with auto-scroll:
- Newest events at bottom (natural chat-like flow)
- Auto-scrolls to bottom on new event (via `useRef` + `scrollIntoView`)
- Each entry: `HH:MM:SS` timestamp, colored dot (from `EVENT_TYPE_CONFIG.dotColor`), label text
- **IMPLICIT events:** Show inline `<input>` for optional 2-3 word label. Placeholder: "etiqueta opcional...". Auto-saves on blur via the `updateEventField` function from `useEventSync` (which handles both local state update AND server PATCH for synced events). Displayed as "[implícito sin etiqueta]" until labeled.
- **QUESTION events:** Show inline `<input>` for the question text. Placeholder: "¿Qué quieres preguntar?". Auto-saves on blur via `updateEventField` with field `'detail'`. Displayed as "[pregunta]" until text entered.
- Read-only for all other event types during capture (no editing, no deleting)

> **Why QUESTION events edit `detail` not `label`?** The `label` field for questions is the short display text ("[pregunta]"). The actual question content goes in `detail`, which supports longer text (up to 5000 chars). This is consistent with SYSTEM events where `label` = system name and `detail` = notes.

8. `src/components/capture/analytics-sidebar.tsx`:

Right-side panel with real-time stats (purely computed from local events array — no API calls):
- Total event count: `events.length`
- Per-hour rate: `Math.round((events.length / Math.max(elapsedMinutes, 1)) * 60)` displayed as "X/hora". The `Math.max(elapsedMinutes, 1)` guard prevents division by zero in the first minute. Display "—" if `events.length === 0`.
- Type frequency bars: horizontal bars per event type, width proportional to count (`count / totalEvents * 100%`), colored by `EVENT_TYPE_CONFIG.dotColor`. Only show types with count > 0.
- Updates reactively as events array changes

> **Performance note:** `analytics-sidebar.tsx` receives the `events` array as a prop and recalculates counts on every render. With React 18, this is efficient enough for hundreds of events (simple `.filter().length` for each of 5 types). Do NOT prematurely optimize with `useMemo` unless profiling shows it's needed. If the array exceeds ~500 events and renders feel sluggish, add `useMemo` with `[events.length]` as dependency (counts only change when length changes, not on label edits — but label edits DO change the reference, so this is a trade-off; accept it for now).

9. `src/components/capture/confirm-end-dialog.tsx`:

Shadcn `AlertDialog` confirmation:
- Title: "¿Terminar sesión de captura?"
- Description: "Se sincronizarán X eventos pendientes. Podrás agregar transcripción y notas a continuación."
- Shows unsynced count from `useEventSync`
- Confirm button: triggers `handleEndSession()` (which captures endTime, flushes, transitions)
- Cancel button: returns to capture

**Event flow (STEP/EDGE):**
1. Tap type button → `selectedType` set → text input focused → suggestions fetched
2. User types label OR taps suggestion chip
3. Enter (or chip tap) → `addEvent(type, label, null, suggestionUsed)` from useEventSync
4. Event appears immediately in log (optimistic)
5. `selectedType` resets to `null`, text input clears
6. Sync hook batches event for background upload

**Event flow (SYSTEM):**
1. Tap Sistema button → system picker popover opens
2. Tap system name (or type custom + confirm)
3. Optionally type detail notes
4. Confirm → `addEvent('SYSTEM', systemName, detailNotes, false)` with detail in event.detail
5. Auto-create open question in background (if API exists — see Step 0 check)
6. Popover dismisses

**Event flow (IMPLICIT/QUESTION):**
1. One tap → `addEvent(type, null, null, false)` immediately
2. Event appears in log with inline text input
3. User optionally types label (IMPLICIT) or detail (QUESTION) → auto-saves on blur

**No unit tests for Group 4.** Manual verification + iPad viewport check (1024×768). Touch target audit: all interactive elements ≥ 48px.

---

### Group 5: Offline Queue + Sync Hook

**Depends on:** Group 2 (batch API endpoint)

**Built together with:** Group 4 (capture UI consumes this hook)

**IMPORTANT — Three bugs fixed from the original design:**

1. **Stale closure in syncPending:** The `syncPending` callback captures `events` from state at creation time. When the 3s interval fires, it reads stale events. **Fix:** Use a ref to track events alongside state, and read from the ref in the sync function.

2. **Local vs server UUID mismatch for label updates:** Events are created locally with `crypto.randomUUID()`, but the server generates its own UUID via `defaultRandom()`. When the batch endpoint returns created events, we must map server IDs back to local IDs so that subsequent PATCH calls use the correct server-side ID. **Fix:** The batch response returns events in insertion order. We map them back by index and store the server ID on each local event.

3. **Race condition between `doSync` (3s interval) and `flushAll`:** If the 3s interval `doSync` captures a list of unsynced events and is about to POST, but `flushAll` runs first and syncs those same events, `doSync` would re-send already-synced events — creating duplicates on the server. **Fix:** `flushAll` clears the interval before syncing and restores it after. Additionally, `doSync` re-reads `eventsRef.current` after checking `isSyncingRef` to get the freshest unsynced list.

**CREATE:**

`src/lib/hooks/use-event-sync.ts`:

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EventType } from '@/lib/db/schema';

export interface LocalEvent {
  localId: string;               // crypto.randomUUID() — client-side only
  serverId: string | null;       // Set after batch sync returns server response
  sessionId: string;
  timestamp: string;             // ISO string
  type: EventType;
  label: string | null;
  detail: string | null;
  suggestionUsed: boolean;
  synced: boolean;               // false = pending sync
}

interface UseEventSyncReturn {
  events: LocalEvent[];
  addEvent: (type: EventType, label: string | null, detail?: string | null, suggestionUsed?: boolean) => LocalEvent;
  updateEventField: (localId: string, field: 'label' | 'detail', value: string) => void;
  unsyncedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  flushAll: () => Promise<void>;
}

export function useEventSync(sessionId: string): UseEventSyncReturn {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ref mirrors state — used by interval callback to avoid stale closure.
  // NOTE: React guarantees useState dispatch (setEvents, setIsOnline, setIsSyncing) identity
  // stability, so they don't need to be in dependency arrays. The exhaustive-deps lint rule
  // may still flag them — suppress with eslint-disable-next-line if needed. Do NOT add them
  // as dependencies, as that would cause unnecessary re-creation of useCallback functions.
  const eventsRef = useRef<LocalEvent[]>([]);
  const isSyncingRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Beforeunload warning when unsynced events exist
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const unsynced = eventsRef.current.filter((ev) => !ev.synced);
      if (unsynced.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Shared sync logic — extracted to avoid duplication between doSync and flushAll.
  // Returns true if sync succeeded, false otherwise.
  // IMPORTANT: Caller is responsible for setting/clearing isSyncing state.
  const executeBatchSync = useCallback(async (): Promise<boolean> => {
    // Read FRESH unsynced list from ref (not a stale captured variable).
    // This is critical: if another sync just completed and marked events as synced,
    // we must see that updated state here.
    const currentEvents = eventsRef.current;
    const unsynced = currentEvents.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return true; // Nothing to sync = success

    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/events/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: unsynced.map((ev) => ({
              sessionId: ev.sessionId,
              timestamp: ev.timestamp,
              type: ev.type,
              label: ev.label,
              detail: ev.detail,
              suggestionUsed: ev.suggestionUsed,
            })),
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const serverEvents = data.events as Array<{ id: string }>;

        // Map server IDs back to local events by index (batch preserves insertion order)
        const localIdToServerId = new Map<string, string>();
        unsynced.forEach((ev, idx) => {
          if (serverEvents[idx]) {
            localIdToServerId.set(ev.localId, serverEvents[idx].id);
          }
        });

        setEvents((prev) =>
          prev.map((ev) => {
            const serverId = localIdToServerId.get(ev.localId);
            if (serverId) {
              return { ...ev, synced: true, serverId };
            }
            return ev;
          })
        );
        return true;
      }
      return false; // Non-ok response
    } catch {
      // Network error — likely offline. Events stay in queue.
      setIsOnline(false);
      return false;
    }
  }, [sessionId]);

  // Core sync function — called by interval timer
  const doSync = useCallback(async () => {
    // Guard: skip if already syncing (flushAll or previous doSync still running)
    if (isSyncingRef.current) return;

    // Quick check: anything to sync? (Avoids state churn)
    const unsynced = eventsRef.current.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return;

    setIsSyncing(true);
    isSyncingRef.current = true;
    try {
      await executeBatchSync();
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [executeBatchSync]);

  // Helper to start the 3s sync interval
  const startSyncInterval = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      doSync();
    }, 3000);
  }, [doSync]);

  // Helper to stop the sync interval
  const stopSyncInterval = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  // Timer-based sync: every 3s
  useEffect(() => {
    startSyncInterval();
    return () => stopSyncInterval();
  }, [startSyncInterval, stopSyncInterval]);

  // Threshold-based sync: flush immediately when ≥5 pending.
  // Uses a ref-based check to avoid re-triggering when events change
  // due to sync completion (which sets synced=true, changing the events array).
  const lastThresholdSyncCountRef = useRef(0);
  useEffect(() => {
    const unsyncedCount = events.filter((ev) => !ev.synced).length;
    // Only trigger if unsynced count crossed the threshold upward
    // (not when it decreased due to a sync completing)
    if (unsyncedCount >= 5 && unsyncedCount > lastThresholdSyncCountRef.current) {
      lastThresholdSyncCountRef.current = unsyncedCount;
      doSync();
    }
    if (unsyncedCount === 0) {
      lastThresholdSyncCountRef.current = 0;
    }
  }, [events, doSync]);

  const addEvent = useCallback(
    (
      type: EventType,
      label: string | null,
      detail: string | null = null,
      suggestionUsed = false
    ): LocalEvent => {
      const event: LocalEvent = {
        localId: crypto.randomUUID(),
        serverId: null,
        sessionId,
        timestamp: new Date().toISOString(),
        type,
        label,
        detail,
        suggestionUsed,
        synced: false,
      };
      setEvents((prev) => [...prev, event]);
      return event;
    },
    [sessionId]
  );

  const updateEventField = useCallback((localId: string, field: 'label' | 'detail', value: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.localId === localId ? { ...ev, [field]: value } : ev
      )
    );

    // If this event has already been synced (has serverId), also PATCH the server.
    // We read serverId from eventsRef which reflects the current state.
    // The serverId was set during a previous sync cycle and is stable once assigned.
    // The field value we're PATCHing comes from the function parameter, not from eventsRef.
    const event = eventsRef.current.find((ev) => ev.localId === localId);
    if (event?.serverId) {
      fetch(`/api/sessions/${sessionId}/events/${event.serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      }).catch(() => {
        // Silently fail — field update is not critical.
        // The updated value is already in local state and will be visible
        // in the event log. If the PATCH fails, the server has the old value
        // but it's not a data-loss scenario — the user can re-edit.
      });
    }
    // If not yet synced (serverId is null), the updated field will be included
    // in the next batch sync because setEvents above already updated the local
    // event's field, and the sync reads from eventsRef which reflects state.
  }, [sessionId]);

  const flushAll = useCallback(async () => {
    // Quick check: anything to sync?
    const unsynced = eventsRef.current.filter((ev) => !ev.synced);
    if (unsynced.length === 0) return;

    // CRITICAL: Stop the 3s interval to prevent a race condition.
    // Without this, doSync could fire mid-flushAll:
    //   1. flushAll reads unsynced = [A, B, C]
    //   2. doSync fires, also reads unsynced = [A, B, C]
    //   3. Both POST the same events → server creates duplicates
    // By clearing the interval, doSync cannot fire during flushAll.
    stopSyncInterval();

    setIsSyncing(true);
    isSyncingRef.current = true;

    try {
      const success = await executeBatchSync();
      if (!success) {
        throw new Error('Batch sync failed during flushAll');
      }
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      // Restart the interval after flushAll completes (success or failure).
      // On failure, the interval will retry on the next 3s tick.
      startSyncInterval();
    }
  }, [executeBatchSync, stopSyncInterval, startSyncInterval]);

  return {
    events,
    addEvent,
    updateEventField,
    unsyncedCount: events.filter((ev) => !ev.synced).length,
    isOnline,
    isSyncing,
    flushAll,
  };
}
```

**CREATE:**

`src/lib/hooks/use-suggestions.ts`:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SuggestionsOutput } from '@/lib/ai/schemas/suggestions';

interface UseSuggestionsReturn {
  suggestions: SuggestionsOutput['suggestions'];
  isLoading: boolean;
  fetchSuggestions: (
    sessionId: string,
    activeType: 'STEP' | 'EDGE',
    eventCount: number
  ) => void;
  clearSuggestions: () => void;
}

export function useSuggestions(): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<SuggestionsOutput['suggestions']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Track mount state to prevent setState on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cleanup all pending timers and requests on unmount
      if (abortRef.current) abortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback(
    (sessionId: string, activeType: 'STEP' | 'EDGE', eventCount: number) => {
      // Abort previous request
      if (abortRef.current) abortRef.current.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      setIsLoading(true);
      setSuggestions([]);

      // Debounce: wait 200ms before firing the request.
      // Prevents wasted API calls when user rapidly toggles between STEP/EDGE.
      // On iPad, rapid taps happen more often than on desktop.
      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;

        // 1.5s timeout: if slow, stop loading and let user type
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setIsLoading(false);
        }, 1500);

        fetch('/api/ai/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, activeType, eventCount }),
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions(data.suggestions ?? []);
              setIsLoading(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          })
          .catch(() => {
            if (!controller.signal.aborted && mountedRef.current) {
              setSuggestions([]);
              setIsLoading(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          });
      }, 200);
    },
    []
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setIsLoading(false);
    if (abortRef.current) abortRef.current.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, isLoading, fetchSuggestions, clearSuggestions };
}
```

**CREATE:**

`src/__tests__/hooks/use-event-sync.test.ts` (~14 tests):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventSync } from '@/lib/hooks/use-event-sync';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useEventSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ created: 0, events: [] }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addEvent creates a local event with synced=false and serverId=null', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Opens email');
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].synced).toBe(false);
    expect(result.current.events[0].serverId).toBeNull();
    expect(result.current.events[0].type).toBe('STEP');
    expect(result.current.events[0].label).toBe('Opens email');
  });

  it('addEvent stores detail field when provided', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('SYSTEM', 'SAP', 'Transaction VA01', false);
    });
    expect(result.current.events[0].detail).toBe('Transaction VA01');
  });

  it('unsyncedCount reflects pending events', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Step 1');
      result.current.addEvent('EDGE', 'Edge 1');
    });
    expect(result.current.unsyncedCount).toBe(2);
  });

  it('flushAll sends batch request and maps server IDs back', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        created: 1,
        events: [{ id: 'server-uuid-123' }],
      }),
    });
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'Step 1');
    });
    await act(async () => {
      await result.current.flushAll();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/session-1/events/batch',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.current.unsyncedCount).toBe(0);
    expect(result.current.events[0].serverId).toBe('server-uuid-123');
  });

  it('updateEventField updates local event label', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('IMPLICIT', null);
    });
    act(() => {
      result.current.updateEventField(event.localId, 'label', 'geography mapping');
    });
    expect(result.current.events[0].label).toBe('geography mapping');
  });

  it('updateEventField updates local event detail', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('QUESTION', null);
    });
    act(() => {
      result.current.updateEventField(event.localId, 'detail', '¿Por qué usan Excel aquí?');
    });
    expect(result.current.events[0].detail).toBe('¿Por qué usan Excel aquí?');
  });

  it('updateEventField PATCHes server when event has serverId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        created: 1,
        events: [{ id: 'server-uuid-456' }],
      }),
    });
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('IMPLICIT', null);
    });
    // Flush to get server ID
    await act(async () => {
      await result.current.flushAll();
    });
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    act(() => {
      result.current.updateEventField(result.current.events[0].localId, 'label', 'new label');
    });
    // Should PATCH with server UUID, not local UUID
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/session-1/events/server-uuid-456',
      expect.objectContaining({ method: 'PATCH' })
    );
    // Verify the PATCH body uses the correct field
    const patchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(patchBody).toEqual({ label: 'new label' });
  });

  it('updateEventField does NOT fire PATCH when event has no serverId', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    let event: any;
    act(() => {
      event = result.current.addEvent('IMPLICIT', null);
    });
    mockFetch.mockClear();
    act(() => {
      result.current.updateEventField(event.localId, 'label', 'test label');
    });
    // Should NOT have called fetch for PATCH — event has no serverId
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('detects offline state via navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    const { result } = renderHook(() => useEventSync('session-1'));
    expect(result.current.isOnline).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
  });

  it('addEvent assigns unique localIds', () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'A');
      result.current.addEvent('STEP', 'B');
    });
    expect(result.current.events[0].localId).not.toBe(result.current.events[1].localId);
  });

  it('addEvent sets timestamp close to now', () => {
    vi.useRealTimers(); // Need real time for this test
    const { result } = renderHook(() => useEventSync('session-1'));
    const before = Date.now();
    act(() => {
      result.current.addEvent('STEP', 'A');
    });
    const after = Date.now();
    const ts = new Date(result.current.events[0].timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    vi.useFakeTimers();
  });

  it('flushAll is no-op when all events synced', async () => {
    const { result } = renderHook(() => useEventSync('session-1'));
    await act(async () => {
      await result.current.flushAll();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flushAll stops and restarts the sync interval to prevent duplicate sends', async () => {
    // This tests the race condition fix: flushAll must stop the 3s interval
    // to prevent doSync from sending the same batch concurrently.
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ created: 1, events: [{ id: 'srv-1' }] }),
    });

    const { result } = renderHook(() => useEventSync('session-1'));
    const initialIntervalCount = setIntervalSpy.mock.calls.length;

    act(() => {
      result.current.addEvent('STEP', 'A');
    });

    await act(async () => {
      await result.current.flushAll();
    });

    // clearInterval should have been called (stopping the timer)
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(0);
    // setInterval should have been called again (restarting the timer)
    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(initialIntervalCount);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it('flushAll throws on sync failure (caller handles error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    const { result } = renderHook(() => useEventSync('session-1'));
    act(() => {
      result.current.addEvent('STEP', 'A');
    });

    await expect(
      act(async () => {
        await result.current.flushAll();
      })
    ).rejects.toThrow('Batch sync failed during flushAll');

    // Events should still be unsynced
    expect(result.current.unsyncedCount).toBe(1);
    // isSyncing should be reset (finally block)
    expect(result.current.isSyncing).toBe(false);
  });
});
```

**CREATE:**

`src/__tests__/hooks/use-suggestions.test.ts` (~6 tests):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSuggestions } from '@/lib/hooks/use-suggestions';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty suggestions and isLoading false', () => {
    const { result } = renderHook(() => useSuggestions());
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading true immediately on fetchSuggestions', () => {
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns suggestions after successful fetch (after debounce)', async () => {
    const mockSuggestions = [
      { text: 'Opens email client', rationale: 'Common first step' },
      { text: 'Checks inbox', rationale: 'Follow-up to opening email' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: mockSuggestions }),
    });
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    // Advance past 200ms debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    // Wait for fetch promise to resolve
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.suggestions).toEqual(mockSuggestions);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('clearSuggestions resets state', () => {
    const { result } = renderHook(() => useSuggestions());
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    act(() => {
      result.current.clearSuggestions();
    });
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('debounce prevents fetch within 200ms window', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    });
    const { result } = renderHook(() => useSuggestions());

    // Fire two rapid calls
    act(() => {
      result.current.fetchSuggestions('session-1', 'STEP', 3);
    });
    act(() => {
      vi.advanceTimersByTime(100); // Only 100ms — still within debounce
    });
    act(() => {
      result.current.fetchSuggestions('session-1', 'EDGE', 4); // Second call resets debounce
    });
    // At this point, no fetch should have fired yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past the debounce from the SECOND call
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Now exactly one fetch should have fired (for EDGE, not STEP)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      activeType: 'EDGE',
    });
  });
});
```

**Verify:** `npx vitest run src/__tests__/hooks` — ~20 tests pass.

---

### Group 6: Post-Capture Screen + Session Status Transitions

**Depends on:** Groups 4, 5 (capture UI + sync hook)

**IMPORTANT — Pre-requisite (Step 0 command #6 + #21 + #22):**

Before implementing this group, confirm that the existing session PATCH route accepts `transcriptText`, `notes`, `status`, and `durationMinutes`. If any field is missing:
- Check the sessions table schema (command #21) — if the column exists but the PATCH route doesn't accept it, update the session update Zod schema and PATCH handler.
- If the column doesn't exist in the table, **stop and flag** — this is a schema gap from a previous phase.

**IMPORTANT — Pre-requisite (Step 0 command #28):**

Confirm the session detail route path. The `onContinue` callback uses `window.location.href` to navigate to the session detail page. The path MUST match the actual route structure under `(dashboard)`. If Step 0 command #28 reveals a different path (e.g., `/sessions/[sessionId]` instead of `/clients/[clientId]/processes/[processId]/sessions/[sessionId]`), update the path below accordingly.

**CREATE:**

`src/components/capture/post-capture-screen.tsx`:

Two textareas (transcript + notes), "Guardar y Continuar" + "Saltar" buttons:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PostCaptureScreenProps {
  sessionId: string;
  processId: string;
  clientId: string;
  eventCount: number;
  durationMinutes: number;
  onContinue: () => void;
}

export function PostCaptureScreen({
  sessionId,
  processId,
  clientId,
  eventCount,
  durationMinutes,
  onContinue,
}: PostCaptureScreenProps) {
  const [transcriptText, setTranscriptText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveAndContinue() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText: transcriptText || null,
          notes: notes || null,
          status: 'completed',
          durationMinutes: Math.round(durationMinutes),
        }),
      });
      if (!res.ok) {
        throw new Error(`PATCH failed: ${res.status}`);
      }
      onContinue();
    } catch (err) {
      console.error('Failed to save post-capture data:', err);
      setSaveError(
        'Error al guardar. Tus datos no se han perdido — intenta de nuevo.'
      );
      setSaving(false);
    }
  }

  async function handleSkip() {
    // Still update status and duration even if skipping transcript/notes.
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          durationMinutes: Math.round(durationMinutes),
        }),
      });
      if (!res.ok) {
        throw new Error(`PATCH failed: ${res.status}`);
      }
      onContinue();
    } catch (err) {
      console.error('Failed to update session status:', err);
      setSaveError(
        'Error al actualizar el estado. Intenta de nuevo.'
      );
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sesión Capturada</h1>
          <p className="text-muted-foreground mt-1">
            {eventCount} eventos registrados en {Math.round(durationMinutes)} minutos.
            Agrega tu transcripción y notas antes de continuar.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pegar Transcripción</CardTitle>
            <CardDescription>
              Si grabaste la sesión con Granola u otra herramienta, pega la transcripción aquí.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Pegar transcripción aquí..."
              className="min-h-[150px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tus Notas</CardTitle>
            <CardDescription>
              Escribe cualquier cosa que observaste que no fue capturada por los botones —
              contexto, impresiones, cosas que quieres recordar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tus notas y observaciones..."
              className="min-h-[150px]"
            />
          </CardContent>
        </Card>

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSaveAndContinue} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar y Continuar'}
          </Button>
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>
            Saltar
          </Button>
        </div>
      </div>
    </div>
  );
}
```

> **Why show an error instead of silently navigating?** If the PATCH fails, the user's transcript and notes are still in local state (the text inputs retain their values). Silently navigating away would discard this content. By showing an error and keeping `saving=false`, the user can retry without re-typing.

**MODIFY:**

`src/components/capture/capture-view.tsx` — Add post-capture state:

```typescript
// State machine: 'capturing' | 'post-capture'
const [mode, setMode] = useState<'capturing' | 'post-capture'>('capturing');
const [startTime] = useState(() => Date.now());
const endTimeRef = useRef<number>(0);
const [flushError, setFlushError] = useState<string | null>(null);

// On mount: set session to in_progress (fire-and-forget).
// If this PATCH fails, capture still works — status will be set to 'completed'
// on End Session anyway. Do NOT block the UI waiting for this response.
useEffect(() => {
  fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  }).catch((err) => console.error('Failed to set session in_progress:', err));
}, [sessionId]);

// End session handler (called from confirm dialog)
async function handleEndSession() {
  // CRITICAL: Capture exact end time BEFORE flushAll, not at render time.
  // If we calculated duration at render time in post-capture mode, the duration
  // would continue to increase while the user fills in transcript/notes.
  endTimeRef.current = Date.now();
  setFlushError(null);

  try {
    await flushAll(); // Wait for all events to sync
    setMode('post-capture');
  } catch (err) {
    // flushAll failed — events are still unsynced.
    // Do NOT transition to post-capture — user stays on capture screen.
    // The 3s sync interval will restart (flushAll's finally block handles this)
    // and will retry on the next tick.
    console.error('Failed to sync events on end session:', err);
    setFlushError(
      'No se pudieron sincronizar los eventos. Verifica tu conexión e intenta de nuevo.'
    );
    // Reset endTimeRef so next attempt recalculates
    endTimeRef.current = 0;
  }
}

// Duration uses the frozen endTime, NOT a live Date.now()
const durationMinutes = endTimeRef.current > 0
  ? (endTimeRef.current - startTime) / 60_000
  : 0;

// Render
if (mode === 'post-capture') {
  return (
    <PostCaptureScreen
      sessionId={sessionId}
      processId={processId}
      clientId={clientId}
      eventCount={events.length}
      durationMinutes={durationMinutes}
      onContinue={() => {
        // INTENTIONAL hard navigation via window.location.href.
        // DO NOT change to router.push(). The (capture) and (dashboard) route groups
        // have completely different layouts (no sidebar vs sidebar). A client-side
        // navigation would attempt to render the dashboard page inside the capture
        // layout, which has no sidebar/breadcrumb. Hard navigation forces a full
        // page load with the correct (dashboard) layout.
        //
        // Step 0 binding (command #28): Replace this path with the ACTUAL route
        // path confirmed in Step 0. If the session detail page is at a different
        // nesting (e.g., /sessions/[sessionId] or /dashboard/sessions/[sessionId]),
        // update this URL accordingly.
        window.location.href = `/clients/${clientId}/processes/${processId}/sessions/${sessionId}`;
      }}
    />
  );
}

// ... normal capture UI rendering
// Pass flushError to capture-header:
// <CaptureHeader
//   sessionTitle={sessionTitle}
//   startTime={startTime}
//   isOnline={isOnline}
//   flushError={flushError}
//   unsyncedCount={unsyncedCount}
//   eventCount={events.length}
//   onEndSession={() => setShowConfirmDialog(true)}
// />
```

**MODIFY:**

Session detail component (Step 0 command #13 confirms the actual file path):

Add a "Iniciar Captura" button for shadowing sessions in `planned` or `in_progress` status:

```typescript
// Only for shadowing sessions — links to the (capture) route group
// Step 0 binding (command #27): If session.type doesn't exist, use a different guard
// (e.g., check if session has eventLogs or a specific flag) or show the button for all sessions.
{session.type === 'shadowing' && ['planned', 'in_progress'].includes(session.status) && (
  <Button asChild>
    <Link href={`/capture/${session.id}`}>
      {session.status === 'in_progress' ? 'Reanudar Captura' : 'Iniciar Captura'}
    </Link>
  </Button>
)}
```

> **Session status transitions for shadowing:**
> `planned` → (Start Capture) → `in_progress` → (End Session) → `completed`
>
> Note: Step 0 command #7 confirms the exact `sessionStatusEnum` values. The plan uses `planned`, `in_progress`, `completed` — which match the Phase 1 schema.

---

## Execution Order

1. **Group 1** — Event type constants + UI config + tests
2. **Groups 2 + 3** — In parallel: Events API + Batch endpoint, Suggestions AI route
3. **Groups 4 + 5** — Together: Capture UI components + offline sync hook (includes middleware update if needed)
4. **Group 6** — Post-capture screen + session status transitions + Start Capture button

---

## Test Summary

| Group | Tests | Type | File |
|-------|-------|------|------|
| 1 — Event Type Config | ~6 | Unit (vitest) | `src/__tests__/unit/capture/event-types.test.ts` |
| 2 — Events API | ~15 | API route (vitest) | `src/__tests__/api/events.test.ts` |
| 2 — Events Batch | ~8 | API route (vitest) | `src/__tests__/api/events-batch.test.ts` |
| 3 — Suggestions AI | ~9 | API route (vitest) | `src/__tests__/api/ai-suggestions.test.ts` |
| 5 — useEventSync | ~14 | Hook unit (vitest) | `src/__tests__/hooks/use-event-sync.test.ts` |
| 5 — useSuggestions | ~6 | Hook unit (vitest) | `src/__tests__/hooks/use-suggestions.test.ts` |
| **Total** | **~58** | | |

---

## Verification Checklist

### After Group 1:
```bash
npx vitest run src/__tests__/unit/db src/__tests__/unit/capture
# All schema + event-type tests pass. Zero regressions.
```

### After Groups 2 + 3:
```bash
npx vitest run
# All ~312+ tests pass (257 existing + ~55 new)
# Zero regressions
```

### After Groups 4 + 5 + 6 (manual):
- [ ] Navigate to a shadowing session → click "Iniciar Captura"
- [ ] Browser navigates to `/capture/[sessionId]` — full screen, no sidebar, no breadcrumb
- [ ] **Verify auth:** Open an incognito window → navigate to `/capture/[sessionId]` → should redirect to login (confirms middleware is protecting the route)
- [ ] Session status changes to `in_progress`
- [ ] Timer runs in header
- [ ] Tap Proceso → text input focuses, suggestions load (or shimmer → timeout → text only)
- [ ] Type label + Enter → event appears in log with green dot
- [ ] Tap Edge Case → text input focuses, suggestions load
- [ ] Tap Sistema → 8-button grid opens, select one → event logged, detail notes optional
- [ ] System event auto-creates open question (verify in DB or questions API) — **OR** if open questions API doesn't exist, verify TODO comment is in code
- [ ] Tap Implícito → event logged instantly, inline label editor appears
- [ ] Tap Pregunta → event logged instantly, inline text editor appears (edits `detail` field)
- [ ] Analytics sidebar shows correct counts and rate (verify "—/hora" shows when 0 events, correct rate after multiple events)
- [ ] Turn off WiFi → "Sin conexión" indicator appears → events still log locally
- [ ] Turn WiFi back on → events sync to server (check via GET events API)
- [ ] Verify server IDs are mapped back (check via console log or debugger)
- [ ] Tap "Terminar" → confirm dialog shows unsynced count → confirm
- [ ] **If flushAll fails:** Verify error message appears ("No se pudieron sincronizar..."), user stays on capture screen, retry works after reconnecting
- [ ] **If flushAll succeeds:** All events flush → post-capture screen appears
- [ ] Verify duration shown in post-capture is frozen (does NOT keep incrementing while you type transcript/notes)
- [ ] Paste transcript + type notes → "Guardar y Continuar" → session status = completed
- [ ] Verify transcriptText and notes are persisted (GET the session and check fields)
- [ ] **If PATCH fails on save:** Verify error message appears, text content is NOT lost, retry works
- [ ] OR "Saltar" → session status = completed (no transcript/notes), verify "Saltar" button is disabled during PATCH
- [ ] Redirected to session detail page in dashboard (full page load, sidebar visible)
- [ ] **Verify redirect path:** Confirm the session detail page loads correctly (not a 404). If 404, check Step 0 command #28 binding.
- [ ] beforeunload warning fires if you try to close tab with unsynced events

### iPad viewport check (1024×768):
- [ ] All buttons ≥ 48px tap target
- [ ] Event type bar doesn't overflow horizontally (all 5 buttons fit)
- [ ] System picker grid is usable (buttons ≥ 48px)
- [ ] Event log scrolls smoothly
- [ ] Text input is not hidden by virtual keyboard (test with on-screen keyboard)

### Inline editing check:
- [ ] Log an IMPLICIT event → type a label in inline input → blur → label persists
- [ ] Log a QUESTION event → type question text in inline input → blur → detail persists
- [ ] After sync completes (3s), check that serverId is set on the event
- [ ] Update the label again → verify PATCH fires to `/api/sessions/{sessionId}/events/{serverId}`
- [ ] Verify PATCH body contains the correct field name (`{ label: "..." }` for IMPLICIT, `{ detail: "..." }` for QUESTION)
- [ ] Log an IMPLICIT event → type a label BEFORE sync → label is included in batch sync payload

### Tailwind dynamic class check:
- [ ] Verify all 5 event type buttons render with correct colors (not stripped by purge)
- [ ] If using string interpolation, check `tailwind.config.ts` safelist includes all color combinations
- [ ] If using lookup map, verify all 5 color stems have entries

### Final:
```bash
npx vitest run
# All ~312+ tests pass, zero regressions
```

---

## Changes from Original Plan (Diff Summary)

This section documents all gaps identified across all review passes and how they were fixed:

1. **Gap: `getAIConfig('suggestions')` profile unspecified.** Fix: Added Step 0 command #16 to verify the profile exists, and explicit instructions in Group 3 to create the profile if missing, with exact model/temperature settings.

2. **Gap: `eventLogs.timestamp` column type ambiguity.** Fix: Added Step 0 command #18 to check the column type, a binding comment in `events.ts` query functions, and a defensive `instanceof Date` guard in `capture-context.ts` that handles both Date objects and strings.

3. **Gap: Clerk middleware not protecting `/capture/*` routes.** Fix: Promoted from "Known Limitation" to a **mandatory pre-requisite in Group 4** with explicit `src/middleware.ts` modification instructions. Added incognito auth verification to the manual checklist.

4. **Gap: `useSuggestions` had no debounce on type toggle.** Fix: Added 200ms debounce via `debounceRef` in the hook. Prevents wasted API calls when user rapidly toggles between STEP and EDGE on iPad.

5. **Gap: `window.location.href` vs `router.push` undocumented decision.** Fix: Added explicit comment in `capture-view.tsx` explaining why hard navigation is intentional (different route group layouts) and warning the junior NOT to "fix" it.

6. **Gap: `countEventsBySession` used O(n) memory.** Fix: Replaced `listEventsBySession().length` with `SELECT count(*)::int` query.

7. **Gap: System picker's open question API path unconfirmed.** Fix: Made the auto-question feature conditional on Step 0 command #10 results. If the API doesn't exist, the junior adds a TODO comment and skips the feature instead of writing a broken API call.

8. **Gap: Session PATCH route body fields unconfirmed.** Fix: Added Step 0 commands #6 (extended to read PATCH handler), #21 (sessions table columns), and #22 (session validation schema) to verify that `transcriptText`, `notes`, `status`, and `durationMinutes` are all accepted by the existing PATCH route. Added critical decision #8 with explicit instructions if fields are missing.

9. **Gap: No tests for `useSuggestions` hook.** Fix: Added `src/__tests__/hooks/use-suggestions.test.ts` with ~6 tests covering initialization, loading state, successful fetch, error handling, clearSuggestions, and debounce verification.

10. **Gap: `getProcessById` import unconfirmed.** Fix: Added Step 0 command #15 to check both `getProcessById` AND `getProcessWithModel`. Added critical decision #10 with fallback instructions.

11. **Gap: `doSync` / `flushAll` race condition.** If the 3s interval `doSync` captures an unsynced list and is about to POST, while `flushAll` runs concurrently and syncs those same events, both send the same batch — creating duplicate events on the server. **Fix:** Refactored `useEventSync` to extract shared `executeBatchSync` logic. `flushAll` now calls `stopSyncInterval()` before syncing and `startSyncInterval()` after.

12. **Gap: Missing soft-delete filter in event queries.** Fix: Added Step 0 commands #23 and #24 to check whether `eventLogs` has a `deletedAt` column and how existing queries implement the pattern. Added `softDeleteFilter` helper in `events.ts`.

13. **Gap: `useSuggestions` abort test was not verifying actual behavior.** Fix: Replaced with a debounce-focused test that verifies rapid calls within 200ms don't fire fetch, only the last call fires after debounce, and the correct `activeType` is sent.

14. **Gap: Misleading comment in `updateEventField`.** Fix: Rewrote the comment to clarify exactly what `eventsRef` does and doesn't have, and why the serverId lookup is safe.

15. **Gap: `z.enum(EVENT_TYPES)` type mismatch with Drizzle's readonly tuple.** Fix: Added `EVENT_TYPES_MUTABLE` export to `schema.ts`. Added Step 0 command #26 to verify the Drizzle type shape. Added note about type narrowing loss in the cast comment.

16. **Gap: No Step 0 verification for Vercel AI SDK / `generateObject`.** Fix: Added Step 0 command #25 to check `package.json`, installed version, and export availability.

17. **Gap: `durationMinutes` calculated at render time, not at end-session time.** Fix: Added `endTimeRef` to `capture-view.tsx`. Duration is frozen at end-session moment.

18. **Gap: `handleSkip` had no error handling or loading state.** Fix: Added `setSaving(true)` + `try/catch` pattern to `handleSkip`, and added `disabled={saving}` to the Skip button.

19. **Gap: No `flushAll` error handling in `handleEndSession`.** The original plan had `await flushAll(); setMode('post-capture');` with no try/catch. If `flushAll` throws (network failure, 500 response), the user sees an unhandled promise rejection with no UI feedback and stays stuck on the capture screen with no explanation. **Fix:** Added try/catch in `handleEndSession`. On failure: log error, show inline error message via `flushError` state, reset `endTimeRef`, stay on capture screen. The sync interval restarts (flushAll's finally block) and will retry. Added verification checklist item for flushAll failure scenario.

20. **Gap: `EVENT_TYPES_MUTABLE` cast loses type narrowing.** `[...EVENT_TYPES] as [string, ...string[]]` produces `[string, ...string[]]` which means `z.enum(EVENT_TYPES_MUTABLE)` produces `z.ZodEnum<[string, ...string[]]>` — Zod's `z.infer<>` yields `string` instead of the union `'STEP' | 'EDGE' | ...`. **Fix:** This is acceptable for validation (runtime behavior is correct) but documented explicitly in the comment on `EVENT_TYPES_MUTABLE` so the junior understands why downstream `z.infer<>` types are wider than expected. Application code should use the `EventType` alias for narrowed types.

21. **Gap: Missing Step 0 verification for `session.type` column.** The capture page checks `session.type !== 'shadowing'` but no Step 0 command verified this column exists. If `session.type` is `undefined`, every session would 404 — complete capture breakage. **Fix:** Added Step 0 command #27 to check for the `type` column and `sessionTypeEnum`. Added critical decision #14 with explicit blocker instructions if the column doesn't exist.

22. **Gap: Missing Step 0 verification for session detail route path.** Post-capture navigates to `/clients/${clientId}/processes/${processId}/sessions/${sessionId}` but this exact path was never verified. If the route structure differs, the user lands on a 404 after completing capture. **Fix:** Added Step 0 command #28 to verify the exact route path. Added critical decision #15. Added verification checklist item for redirect path.

23. **Gap: No org-scoping on event reads (authorization).** The GET events endpoint uses `requireUserId` (any authenticated user) but doesn't verify the session belongs to the caller's organization. Any authenticated user could read events from any session by guessing the UUID. **Fix:** Added Step 0 command #29 to check the existing org-scoping pattern. Added critical decision #16. If existing session queries already filter by orgId, events are implicitly scoped (the capture page looks up the session first). If not, documented as Known Limitation #7.

24. **Gap: In-memory suggestion cache misleading on serverless.** The suggestions route uses a `Map` cache with 30s TTL, but on Vercel serverless each invocation may cold-start. Cache hit rate approaches 0%. **Fix:** Added inline comment documenting this limitation — the cache still helps in development and warm invocations.

25. **Gap: System picker options hardcoded.** Every session shows the same 8 systems regardless of client or industry. **Fix:** Extracted options to `DEFAULT_SYSTEM_OPTIONS` constant in `event-types.ts`. Documented as Known Limitation #6.

26. **Gap: Security-critical batch test had no implementation.** The "overrides sessionId from URL param" test is the most important security test in the phase but had `/* ... */` as its body. A junior developer would either skip it or write a superficial test. **Fix:** Expanded the test body with explicit arrange/act/assert pattern, mock setup, and the exact assertion that all events use the URL param sessionId, not the body sessionId.

27. **Gap: Events API tests missing `detail` field assertion.** The test list included "creates a SYSTEM event with detail notes" but with no assertion pattern showing `detail` is persisted. Added explicit assertion in the test description. Also added a fourth test for QUESTION events with null detail.

28. **Gap: `flushAll` failure test missing.** The useEventSync tests didn't verify that `flushAll` throws on sync failure, which is critical since `handleEndSession` now relies on catching that throw. **Fix:** Added test `flushAll throws on sync failure (caller handles error)` verifying the throw, that events remain unsynced, and that isSyncing is reset.

29. **Gap: `updateEventLabel` only supports `label`, not `detail`.** QUESTION events need inline editing of the `detail` field (the question text), not just `label`. The original `updateEventLabelSchema` only accepted `label`. **Fix:** Renamed to `updateEventSchema` with both `label` and `detail` as optional fields + a Zod `.refine()` requiring at least one. Renamed `updateEventLabel` query function to `updateEvent` with dynamic SET clause. Renamed hook function to `updateEventField` accepting `(localId, field, value)`. Added test for detail updates. Added PATCH body field verification to checklist.

30. **Gap: `useSuggestions` hook had no cleanup on unmount.** If the component unmounts while a fetch is in flight, the resolved promise calls `setSuggestions` on an unmounted component — a React warning and potential memory leak. **Fix:** Added `mountedRef` tracked via `useEffect` cleanup. All state updates in fetch callbacks check `mountedRef.current` before calling setState. Cleanup function also aborts pending requests and clears timers.

31. **Gap: Threshold-based sync could cause unnecessary re-triggers.** The `useEffect` watching `events` for `unsyncedCount >= 5` would fire on EVERY events change, including when sync marks events as synced (changing the array reference). This creates a tight loop: sync completes → events change → effect fires → checks unsynced count → count is now 0 → no-ops (guarded by isSyncingRef). While not an infinite loop (the guard prevents it), it's unnecessary churn. **Fix:** Added `lastThresholdSyncCountRef` to only trigger when unsynced count crosses the threshold upward, not when it decreases due to sync completion.

32. **Gap: Tailwind dynamic class purging.** The `event-type-bar.tsx` uses `color` from config to build dynamic Tailwind classes like `` `bg-${config.color}-600` ``. Tailwind's JIT compiler purges classes it can't find as full strings in source code, so dynamic interpolation results in missing styles at runtime. **Fix:** Added explicit documentation in the event-type-bar component description recommending a static `COLOR_CLASSES` lookup map over string interpolation, with full code example.

33. **Gap: `capture-header.tsx` props interface undefined.** The plan described the header component's behavior but never specified its props interface. A junior would have to guess which values come as props vs. which are computed internally. **Fix:** Added explicit `CaptureHeaderProps` interface with all required props. Added timer implementation guidance with `useEffect`/`useState` pattern (not rAF).

34. **Gap: Post-capture `handleSaveAndContinue` silently discards data on PATCH failure.** The `try/finally` pattern always navigated away regardless of success. If the PATCH returned 500, the user's transcript and notes were lost. **Fix:** Changed to `try/catch` with `saveError` state. On failure, shows error message, keeps saving=false so user can retry, content stays in textarea state.

35. **Gap: Missing Step 0 commands for Drizzle version and testing library.** `sql<number>` generic requires Drizzle v0.28+, and `renderHook` requires `@testing-library/react` v14+. **Fix:** Added Step 0 commands #30 and #31 with version checks and fallback instructions.

36. **Gap: No test for `addEvent` storing `detail` field.** The hook stores `detail` in local events but no test verified this. **Fix:** Added test `addEvent stores detail field when provided` asserting SYSTEM event detail is stored.

37. **Gap: QUESTION event inline editing semantics undocumented.** The plan said QUESTION events have "inline text editor" but didn't specify which field it edits. Since questions are longer-form content, they should edit `detail` (up to 5000 chars) not `label` (up to 500 chars). **Fix:** Documented that QUESTION edits `detail`, IMPLICIT edits `label`. Added explanation in event-log-panel description.

38. **Gap: `analytics-sidebar.tsx` performance with large event arrays.** The sidebar recomputes type counts on every render by filtering the entire events array. With 500+ events and frequent state updates (from the 3s sync cycle marking events as synced), this could cause visible jank on iPad. **Fix:** Added performance note documenting the trade-off and when to add `useMemo`. Not adding it now (premature optimization) but flagged so the junior knows to profile if performance degrades.

---

## Known Limitations (Phase 5 scope)

1. **No IndexedDB persistence:** Offline events live in React state. If the browser tab crashes or is force-closed, unsynced events are lost. This is acceptable per the spec (future upgrade path).
2. **No keyboard shortcuts yet:** The `shortcutKey` field is defined in `EVENT_TYPE_CONFIG` but not wired. Future enhancement.
3. **No event reordering or deletion during capture:** Events are append-only. Editing past events happens in the debrief phase (Phase 6).
4. **Suggestion quality depends on L1 library seeding:** If domain JSONs aren't seeded for the process type, suggestions will be generic. This is a pre-build dependency flagged in Phase 3.
5. **No duplicate event detection in batch sync:** If the sync fires twice before the first response returns, the same events could be inserted twice. Mitigation: the `isSyncingRef` flag prevents overlapping requests, and `flushAll` clears the interval to prevent concurrent `doSync` execution. For true idempotency, a server-side upsert on a client-provided UUID would be needed — not in Phase 5 scope.
6. **System picker options are hardcoded:** The 8 system options (`DEFAULT_SYSTEM_OPTIONS`) are generic. A future enhancement could make them configurable per client or process type (e.g., a manufacturing client would see different systems than a logistics client).
7. **No org-scoping on event reads (conditional):** If Step 0 command #29 reveals that `getSessionById` does NOT filter by orgId, any authenticated user could read events for any session. The capture page itself is protected (it looks up the session server-side), but the GET events API endpoint is directly accessible. This should be fixed in Phase 6 by adding org-scoping to the event queries or to the session lookup used by the API.
8. **Multi-tab capture not prevented:** If two browser tabs open the same session's capture page, both will create events independently. The 3s sync intervals and flushAll calls do not coordinate across tabs. Events from both tabs will be persisted but may have overlapping timestamps and no indication of which tab created which events. A future enhancement could use a BroadcastChannel or server-side lock.