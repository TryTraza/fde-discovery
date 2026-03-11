# Phase 3 — Process CRUD + Hypothesis Generation (v6 — Post-Review)

> **v6 Review changelog — 13 additional issues found on top of the 55 v5 fixes:**
>
> The v5 plan applied fixes FIX1–FIX55. This v6 review validates those AND resolves 13 additional gaps found during a ruthless fullstack audit. Issues marked 🆕v6 are new; all prior fixes (FIX1–FIX55) are confirmed valid and integrated.
>
> | # | Severity | Gap | Fix |
> |---|----------|-----|-----|
> | 56 | **HIGH** | `triggerProcessHypothesis` .then() calls `updateProcessModel(processId, ...)` unconditionally. If `createProcessModel` hasn't committed yet (fire-and-forget races with initial creation) or the model row doesn't exist, `updateProcessModel` returns null and steps are silently lost. | Added null-check + retry logic in `triggerProcessHypothesis` .then() chain. Document race window. |
> | 57 | **HIGH** | `getAIConfig('hypothesis', apiKey)` assumes `'hypothesis'` is a valid config key. No pre-flight verifies which config keys exist. If only `'company-research'` exists, this will throw or return undefined. | Added pre-flight #20 to verify `getAIConfig` accepted keys and add `'hypothesis'` config if missing. |
> | 58 | **HIGH** | `config.maxOutputTokens` used in `generateHypothesis` but `getAIConfig` may return `maxTokens` (AI SDK v4/v5) or a completely different field. Risk table mentions this but doesn't resolve it. | Pre-flight #20 now also verifies the exact field name returned by `getAIConfig`. |
> | 59 | **HIGH** | `CreateProcessDialog` handles `res.status === 422` as "no API key" but the POST route NEVER returns 422. POST returns 201 regardless of API key presence (hypothesis is just skipped). Dialog has dead code path. | POST route now includes `hypothesisTriggered: boolean` in 201 response. Dialog uses this field instead of checking for 422. |
> | 60 | **HIGH** | `ProcessDetailCard` (Step 3.5.3) has only a code snippet for `handleSave` — no component skeleton. Every other component in 3.5 has at least a skeleton. A junior implementing this will guess the structure. | Added full component skeleton with inline-edit pattern for all fields. |
> | 61 | **MEDIUM** | GET list route calls `getClientById(id)` but doesn't verify user access to that client. If `getClientById` doesn't internally filter by org/user, any authenticated user can list any client's processes. Pre-flight #16 decision tree covers this but route code doesn't act on it. | Added explicit comment block and code placeholder for ownership enforcement in all routes. |
> | 62 | **MEDIUM** | `CreateProcessDialog` doesn't reset form state on close. User opens dialog, fills data, cancels, reopens → stale data visible. | Added state reset in `onOpenChange` handler when `open` becomes false. |
> | 63 | **MEDIUM** | `HypothesisCard` auto-poll only fires when `process.status === 'draft'`. If user regenerates hypothesis on a `mapping`-status process and navigates away mid-generation, returning won't resume polling. | Broadened auto-poll condition: poll when `hypothesisText` is null OR when a `_regenerating` flag (stored in component state) is set. |
> | 64 | **MEDIUM** | `softDeleteProcess` cascade to `processModels` doesn't filter by `isNull(processModels.deletedAt)`. Re-stamps already-deleted models. | Added `isNull(processModels.deletedAt)` filter to cascade. |
> | 65 | **MEDIUM** | No SWR `revalidateOnFocus` consideration. Default SWR revalidates on window focus, which will conflict with manual polling in `HypothesisCard` and cause unnecessary API calls on tab-switch. | Added `revalidateOnFocus: false` to `useProcess` hook where polling is managed manually. |
> | 66 | **LOW** | Hypothesis regenerate route (3.3.6) doesn't accept a request body. User cannot pass updated `knownSystems`/`knownPainPoints` when regenerating. Original AI context is permanently lost (FIX53 documents this). | Added optional body parsing to regenerate route. If body present, pass context to trigger function. Documented as enhancement. |
> | 67 | **LOW** | `ProcessWithModel` type depends on Drizzle's `InferSelectModel` types via `ReturnType<typeof getProcessWithModel>`. If Drizzle types reference server-only modules, `import type` in `'use client'` file could cause module resolution issues in edge cases. | Added a standalone interface definition as fallback, with instructions to use `import type` first and switch to manual interface if build errors occur. |
> | 68 | **LOW** | File count updated: still 21 source + 7 test = 28 total (no new files from v6 fixes, only modifications to existing planned files). | Confirmed accurate. |

---

## Context

Phase 2 (Client CRUD + Company Research) is complete with 107 tests passing. Phase 3 adds process management under clients: L1 domain knowledge, AI-powered hypothesis generation, CRUD API routes, creation UI, and a process detail page with a visual flow of ProcessModel steps.

Key advantage: the query layer (`src/lib/db/queries/processes.ts`) and schema already exist from Phase 1. This phase builds the API, AI, and UI layers on top.

**⚠️ Architecture reminder — Per-User API Keys:**
This project does NOT use a server-side `ANTHROPIC_API_KEY`. Each user stores their own Anthropic API key in Clerk `privateMetadata`. All AI features must:
1. Extract the key from Clerk BEFORE the HTTP response returns (auth context is lost after response).
2. Pass the key explicitly to any fire-and-forget AI function.
3. Gracefully handle missing keys (user hasn't configured one yet).

**Pre-flight checks before starting Phase 3:**

```bash
# 1. Confirm existing queries exist and export what we need
grep -n "export" src/lib/db/queries/processes.ts
# MUST see: createProcess, getProcessesByClientId, getProcessById, createProcessModel
# If updateProcess is missing → we add it in Step 3.1
# If updateProcessModel is missing → we add it in Step 3.1
# 🆕v3 FIX23: ALSO verify getProcessById filters soft-deleted records:
grep -A 10 "export async function getProcessById" src/lib/db/queries/processes.ts
# MUST see isNull(processes.deletedAt) in the WHERE clause.
# If it does NOT filter deletedAt → add the filter before proceeding.

# 2. Verify createProcessModel function signature
grep -A 10 "export async function createProcessModel" src/lib/db/queries/processes.ts
# Check: does it take just processId, or processId + data?
# We need to match this signature in Step 3.3

# 3. Confirm process table columns include hypothesisText and processTypeL1
grep -n "hypothesisText\|processTypeL1" src/lib/db/schema.ts
# MUST see both as TOP-LEVEL columns on the processes table (not inside JSONB)

# 4. Confirm processModels table has deletedAt column
grep -A 20 "processModels" src/lib/db/schema.ts | grep "deletedAt"
# If missing → skip cascade delete, add TODO comment

# 5. Confirm resolveJsonModule is enabled
grep "resolveJsonModule" tsconfig.json
# MUST be true (needed for JSON imports in Step 3.1)

# 6. Confirm AI config pattern exists and verify per-user key pattern
cat src/lib/ai/get-ai-config.ts | head -30
# Verify getAIConfig accepts an API key parameter (per-user architecture)

# 7. Confirm parseJSON helper exists AND verify its contract
grep -n "parseJSON" src/lib/api/utils.ts
# 🆕v4 FIX28: CRITICAL — determine:
#   (a) Does parseJSON RETURN null on malformed JSON, or THROW?
#   (b) Does it return the parsed body, or a wrapper { data, error }?
# Read the full implementation:
cat src/lib/api/utils.ts
# If it THROWS → all route handlers need try-catch around parseJSON.
# If it returns null → the `if (!body)` pattern in the plan is correct.
# Document the actual contract as a comment in route files.

# 8. Verify company-research pattern for fire-and-forget + per-user key
cat src/lib/ai/prompts/company-research.ts | head -50
# Look for: how the API key is passed, how fire-and-forget works

# 9. Verify auth helpers return types AND behavior
grep -A 10 "export.*requireAdmin\|export.*requireUserId" src/lib/auth.ts
# 🆕v3 FIX20: CRITICAL — determine:
#   (a) Does requireAdmin RETURN null on unauthorized, or THROW?
#   (b) Does it return a plain string (userId), or an object { userId, role }?
#   (c) Same questions for requireUserId.
# Document the actual signatures as comments at the top of EVERY route file.
# If they THROW → do NOT use if(!userId) pattern; use try-catch instead.
# If they return an object → destructure: const { userId } = requireAdmin();

# 10. Run existing tests
npx vitest run
# MUST see 107 tests passing

# 🆕v3 FIX21: 11. Verify test infrastructure pattern
ls src/__tests__/db/ 2>/dev/null || echo "No DB test directory yet"
grep -r "vi.mock.*db\|vi.mock.*drizzle\|beforeAll.*migrate\|setupTestDb" src/__tests__/ | head -10
# Determine: do existing query tests use vi.mock (mocked DB) or a real test database?
# Match whichever pattern is established.

# 🆕v4: 12. Verify getUserApiKey helper exists
grep -rn "getUserApiKey\|getApiKey\|anthropicApiKey" src/lib/ | head -10
# If nothing found → we must create it in Step 3.3.2

# 🆕v4: 13. Verify index on processModels.processId
grep -A 5 "processModels" src/lib/db/schema.ts | grep -i "index\|references"
# If no index → add TODO for next migration, not blocking

# 🆕v4: 14. Verify toast library
grep -rn "from.*sonner\|from.*react-hot-toast\|from.*toast" src/components/ | head -5
# Determine which toast library the project uses. Match it exactly.

# 🆕v4: 15. Verify navigation pattern (breadcrumbs vs back links)
grep -rn "Breadcrumb\|BackLink\|backLink\|ChevronLeft" src/components/ src/app/ | head -10
# Match whichever pattern exists.

# 🆕v4: 16. Verify contacts route ownership check pattern
cat src/app/api/clients/[id]/contacts/route.ts | head -30
# Look for: does it verify user has access to clientId? How?
# 🆕v5 FIX48: DECISION TREE — after reading the contacts route:
#   (a) If contacts route calls getClientById AND getClientById already
#       filters by orgId/userId → same pattern works, replicate it.
#   (b) If contacts route does an EXTRA explicit check (e.g., client.orgId === user.orgId)
#       → replicate that exact check in process routes.
#   (c) If contacts route does NO ownership check at all → THIS IS A BUG.
#       Add the ownership check to BOTH contacts and processes routes.
#       Use: getClientById must filter by userId/orgId from auth context.
# We MUST replicate the same pattern in process routes.

# 🆕v5: 17. Verify getProcessesByClientId filters soft-deleted records
grep -A 10 "export async function getProcessesByClientId" src/lib/db/queries/processes.ts
# MUST see isNull(processes.deletedAt) in the WHERE clause.
# If it does NOT filter deletedAt → add the filter before proceeding.

# 🆕v5: 18. Verify createProcess function signature and expected parameters
grep -A 15 "export async function createProcess" src/lib/db/queries/processes.ts
# Check: does it take an object? What are the field names?
# The POST route will call createProcess({ clientId, name, description, departmentTag })
# Verify these exact field names match the function's parameter type.
# If the function expects e.g. `client_id` instead of `clientId`, fix the route call.

# 🆕v5: 19. Verify existing API route test patterns (for Step 3.3.7)
ls src/__tests__/api/ 2>/dev/null && head -60 src/__tests__/api/*.test.ts 2>/dev/null
# Look for:
#   - How NextRequest is created in tests
#   - How auth (requireAdmin/requireUserId) is mocked
#   - How DB query modules are mocked
#   - Whether tests call route handlers directly or use a test client
# Copy the EXACT same pattern for process route tests.

# 🆕v6 FIX57 FIX58: 20. Verify getAIConfig accepted keys and return shape
cat src/lib/ai/get-ai-config.ts
# CRITICAL — determine:
#   (a) What config keys does getAIConfig accept? (e.g., 'company-research', 'hypothesis')
#       If 'hypothesis' is NOT a valid key → add it to the config map.
#   (b) What fields does the returned config object contain?
#       Does it return `maxOutputTokens` or `maxTokens`?
#       Does it return `model` as an AI SDK model object or a string?
# Match the exact return shape in generateHypothesis.
# If the function uses a switch/map of config keys, add a 'hypothesis' entry.
# If it returns maxTokens, use maxTokens (not maxOutputTokens) in generateObject call.
```

---

## Step 3.1 — L1 Domain JSON Files + Loader + Shared Validations + Query Layer Gap Fix

**Goal:** Create domain knowledge files, a loader module, shared validation schemas, and fill any missing query functions.

| Action | File |
|--------|------|
| CREATE | `src/lib/domain/l1/procurement.json` |
| CREATE | `src/lib/domain/l1/unknown.json` |
| CREATE | `src/lib/domain/l1/index.ts` — exports `getL1(type)`, `getAllL1Types()`, `getAllL1Domains()` |
| CREATE | `src/lib/validations/process.ts` — shared Zod schemas 🆕v3 FIX22 |
| MODIFY | `src/lib/db/queries/processes.ts` — add `updateProcess()`, `updateProcessModel()`, `softDeleteProcess()`, `getProcessWithModel()`, export `ProcessWithModel` type 🔧 FIX1 FIX7 FIX8 FIX14 🆕v5 FIX51 |
| CREATE | `src/__tests__/domain/l1-loader.test.ts` |
| CREATE | `src/__tests__/validations/process.test.ts` |
| CREATE | `src/__tests__/db/process-queries.test.ts` — tests for new query functions |

### 3.1.1 — JSON Structure

```jsonc
// src/lib/domain/l1/procurement.json
{
  "type": "procurement",
  "label": "Procurement / Purchasing",
  "typicalSteps": [
    {
      "name": "Purchase Request Received",
      "description": "An internal request for goods/services is submitted",
      "typicalSystems": ["ERP", "Email", "Internal Portal"]
    },
    {
      "name": "Vendor Selection",
      "description": "Appropriate vendor is identified or RFQ is sent",
      "typicalSystems": ["ERP", "Vendor Portal"]
    },
    {
      "name": "Purchase Order Creation",
      "description": "Formal PO is created and sent to vendor",
      "typicalSystems": ["ERP"]
    },
    {
      "name": "Order Confirmation",
      "description": "Vendor confirms PO and provides delivery timeline",
      "typicalSystems": ["Email", "Vendor Portal"]
    },
    {
      "name": "Goods Receipt",
      "description": "Physical or digital delivery is received and verified",
      "typicalSystems": ["ERP", "Warehouse System"]
    },
    {
      "name": "Invoice Matching",
      "description": "Invoice matched against PO and receipt (3-way match)",
      "typicalSystems": ["ERP", "Accounts Payable"]
    },
    {
      "name": "Payment Processing",
      "description": "Payment is authorized and executed",
      "typicalSystems": ["ERP", "Banking Portal"]
    }
  ],
  "commonEdgeCases": [
    { "description": "PO amount exceeds approval threshold", "frequency": "common" },
    { "description": "Vendor delivers wrong quantity", "frequency": "occasional" },
    { "description": "Invoice doesn't match PO", "frequency": "common" },
    { "description": "Urgent purchase bypasses normal flow", "frequency": "occasional" }
  ],
  "commonSystems": ["SAP", "Oracle", "NetSuite", "Coupa", "Ariba"],
  "industryVariations": {
    "manufacturing": "Often includes quality inspection step before goods receipt",
    "services": "May skip goods receipt, uses service entry sheet instead",
    "retail": "High volume, often automated reorder points"
  }
}
```

```jsonc
// src/lib/domain/l1/unknown.json
{
  "type": "unknown",
  "label": "General / Unclassified",
  "typicalSteps": [
    { "name": "Input Received", "description": "Process trigger or input arrives", "typicalSystems": [] },
    { "name": "Processing", "description": "Core work is performed", "typicalSystems": [] },
    { "name": "Output Delivered", "description": "Result or deliverable is produced", "typicalSystems": [] }
  ],
  "commonEdgeCases": [
    { "description": "Input is incomplete or malformed", "frequency": "common" },
    { "description": "Manual override required", "frequency": "occasional" }
  ],
  "commonSystems": [],
  "industryVariations": {}
}
```

### 3.1.2 — Loader

```typescript
// src/lib/domain/l1/index.ts
import procurement from './procurement.json';
import unknown from './unknown.json';

// NOTE: requires "resolveJsonModule": true in tsconfig.json (verified in pre-flight #5)
// Using static imports (not fs.readFileSync) for edge runtime compatibility

export interface L1Step {
  name: string;
  description: string;
  typicalSystems: string[];
}

export interface L1EdgeCase {
  description: string;
  frequency: string;
}

export interface L1Domain {
  type: string;
  label: string;
  typicalSteps: L1Step[];
  commonEdgeCases: L1EdgeCase[];
  commonSystems: string[];
  industryVariations: Record<string, string>;
}

const domains: Record<string, L1Domain> = {
  procurement,
  unknown,
};

export function getL1(type: string): L1Domain {
  return domains[type] ?? domains['unknown'];
}

export function getAllL1Types(): string[] {
  return Object.keys(domains);
}

export function getAllL1Domains(): L1Domain[] {
  return Object.values(domains);
}
```

### 3.1.3 — Shared Validation Schemas 🆕v3 FIX22 + 🆕v4 FIX30 FIX33

```typescript
// src/lib/validations/process.ts
//
// 🆕v3 FIX22: Shared location so BOTH API routes AND UI components can import.
// Do NOT define these inside route files — client components can't import from app/api/.

import { z } from 'zod';

// --- Status transition validation 🆕v4 FIX30 ---

export const PROCESS_STATUSES = ['draft', 'mapping', 'validated', 'locked'] as const;
export type ProcessStatus = typeof PROCESS_STATUSES[number];

// Defines which status transitions are allowed.
// Key = current status, Value = array of statuses you can transition TO.
export const VALID_TRANSITIONS: Record<ProcessStatus, ProcessStatus[]> = {
  draft: ['mapping'],
  mapping: ['draft', 'validated'],       // can go back to draft
  validated: ['mapping', 'locked'],      // can go back to mapping
  locked: [],                            // terminal state — no transitions allowed
};

export function validateStatusTransition(
  current: ProcessStatus,
  next: ProcessStatus
): { valid: boolean; error?: string } {
  if (current === next) return { valid: true }; // no-op is always valid
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    return {
      valid: false,
      error: `Cannot transition from "${current}" to "${next}". Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }
  return { valid: true };
}

// --- Create schema ---

// POST create schema — used by API route and CreateProcessDialog
// 🆕v5 FIX53: knownSystems and knownPainPoints are NOT persisted in the DB.
// They are used ONLY as AI context for hypothesis generation.
// The POST route validates these fields but passes them only to triggerProcessHypothesis.
// If hypothesis generation fails, these inputs are lost. This is intentional —
// the user can regenerate with the same or different context later.
export const createProcessSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  departmentTag: z.string().optional(),
  knownSystems: z.array(z.string()).optional(),      // AI-only context, NOT persisted
  knownPainPoints: z.string().optional(),             // AI-only context, NOT persisted
});

export type CreateProcessInput = z.infer<typeof createProcessSchema>;

// --- Regenerate hypothesis schema 🆕v6 FIX66 ---

// Optional body for hypothesis regeneration route.
// If provided, these override the stored process fields for AI context.
export const regenerateHypothesisSchema = z.object({
  knownSystems: z.array(z.string()).optional(),
  knownPainPoints: z.string().optional(),
}).optional();

export type RegenerateHypothesisInput = z.infer<typeof regenerateHypothesisSchema>;

// --- Update schema ---

// PATCH update schema — all fields optional, AI-only fields EXCLUDED
// 🔧 FIX4: Explicit schema with validation
// 🔧 FIX17: hypothesisText and processTypeL1 are NOT user-editable via PATCH.
// 🆕v4 FIX33: Explicit .strip() so unknown keys are always removed regardless of parse mode.
export const updateProcessSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(PROCESS_STATUSES).optional(),
  departmentTag: z.string().nullable().optional(),
  // NOTE: hypothesisText and processTypeL1 intentionally excluded.
  // These are set by triggerProcessHypothesis, not by user edits.
  // Unknown keys (like hypothesisText) are stripped by .strip(), then
  // refine checks at least one valid field remains.
}).strip().refine(obj => Object.keys(obj).length > 0, {
  message: 'At least one field must be provided',
});

export type UpdateProcessInput = z.infer<typeof updateProcessSchema>;

// --- JSONB step parsing 🆕v4 FIX34 ---

// Runtime schema for parsing process steps from JSONB.
// JSONB can contain anything — this ensures type safety at the boundary.
export const processStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  order: z.number(),
  systems: z.array(z.object({
    name: z.string(),
    confirmed: z.boolean().default(false),
    detailNotes: z.string().default(''),
  })).default([]),
  confidence: z.enum(['confirmed', 'inferred', 'missing']).default('inferred'),
  edgeCases: z.array(z.any()).default([]),
  notes: z.string().default(''),
});

export type ProcessStepParsed = z.infer<typeof processStepSchema>;

/**
 * Safely parse JSONB steps array. Returns empty array on any failure.
 * Use this in ALL UI components that read process.model.steps.
 */
export function parseProcessSteps(raw: unknown): ProcessStepParsed[] {
  if (!raw || !Array.isArray(raw)) return [];
  try {
    return raw
      .map((item) => processStepSchema.safeParse(item))
      .filter((result): result is z.SafeParseSuccess<ProcessStepParsed> => result.success)
      .map((result) => result.data)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}
```

### 3.1.4 — Query Layer Additions 🔧 FIX1, FIX7, FIX8, FIX14, 🆕v4 FIX43, 🆕v5 FIX51, 🆕v6 FIX64

Add these to `src/lib/db/queries/processes.ts`:

```typescript
// --- 🆕v5 FIX51: Exported type for ProcessWithModel ---
// Use this type in SWR hooks and all UI components that consume process + model data.
// It represents the return shape of getProcessWithModel (process fields + nested model).
//
// 🆕v6 FIX67: If importing this type in a 'use client' file causes build errors
// because Drizzle types reference server-only modules, replace the ReturnType-based
// definition below with this manual interface:
//
// export interface ProcessWithModel {
//   id: string;
//   clientId: string;
//   name: string;
//   description: string | null;
//   status: string;
//   departmentTag: string | null;
//   processTypeL1: string | null;
//   hypothesisText: string | null;
//   createdAt: Date;
//   updatedAt: Date;
//   deletedAt: Date | null;
//   model: {
//     id: string;
//     processId: string;
//     steps: unknown;
//     edgeCases: unknown;
//     metadata: unknown;
//     createdAt: Date;
//     updatedAt: Date;
//     deletedAt: Date | null;
//   } | null;
// }

// 🔧 FIX14: updateProcess — needed by triggerProcessHypothesis AND by PATCH route
// Verify this doesn't already exist. If it does, skip.
export async function updateProcess(
  processId: string,
  data: Partial<{
    name: string;
    description: string | null;
    status: string;
    departmentTag: string | null;
    processTypeL1: string | null;
    hypothesisText: string | null;
  }>
) {
  const [updated] = await db
    .update(processes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(processes.id, processId), isNull(processes.deletedAt)))
    .returning();

  return updated ?? null;
}

// 🔧 FIX1: updateProcessModel — needed by triggerProcessHypothesis
export async function updateProcessModel(
  processId: string,
  data: { steps?: any[]; edgeCases?: any[]; metadata?: any }
) {
  const existing = await db
    .select()
    .from(processModels)
    .where(eq(processModels.processId, processId))
    .then(rows => rows[0]);

  if (!existing) return null;

  const [updated] = await db
    .update(processModels)
    .set({
      steps: data.steps ?? existing.steps,
      edgeCases: data.edgeCases ?? existing.edgeCases,
      metadata: data.metadata ?? existing.metadata,
      updatedAt: new Date(),
    })
    .where(eq(processModels.processId, processId))
    .returning();

  return updated;
}

// 🔧 FIX7 + 🆕v4 FIX43: getProcessWithModel — detail endpoint needs model joined
// Uses LEFT JOIN instead of two sequential queries for performance.
export async function getProcessWithModel(processId: string) {
  const rows = await db
    .select({
      process: processes,
      model: processModels,
    })
    .from(processes)
    .leftJoin(processModels, eq(processes.id, processModels.processId))
    .where(and(eq(processes.id, processId), isNull(processes.deletedAt)));

  const row = rows[0];
  if (!row) return null;

  return { ...row.process, model: row.model ?? null };
}

// 🆕v5 FIX51: Export the return type so SWR hooks and UI components can use it.
export type ProcessWithModel = NonNullable<Awaited<ReturnType<typeof getProcessWithModel>>>;

// 🔧 FIX8 + 🆕v6 FIX64: softDeleteProcess — cascades to process_models
export async function softDeleteProcess(processId: string) {
  const now = new Date();

  const [deleted] = await db
    .update(processes)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(processes.id, processId), isNull(processes.deletedAt)))
    .returning();

  if (deleted) {
    // Soft-delete orphaned model
    // ⚠️ Pre-flight check #4 must confirm processModels has deletedAt column.
    // If it doesn't, SKIP this block and add: // TODO: add deletedAt to process_models in next migration
    // 🆕v6 FIX64: Only update models that aren't already soft-deleted.
    await db
      .update(processModels)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(
        eq(processModels.processId, processId),
        isNull(processModels.deletedAt)
      ));
  }

  return deleted ?? null;
}
```

### 3.1.5 — Tests

**L1 Loader tests** (`src/__tests__/domain/l1-loader.test.ts`) — 5 tests:

```typescript
import { describe, it, expect } from 'vitest';
import { getL1, getAllL1Types, getAllL1Domains } from '@/lib/domain/l1';

describe('L1 Domain Loader', () => {
  it('loads procurement domain', () => {
    const domain = getL1('procurement');
    expect(domain.type).toBe('procurement');
    expect(domain.typicalSteps.length).toBeGreaterThan(0);
    expect(domain.typicalSteps[0]).toHaveProperty('name');
    expect(domain.typicalSteps[0]).toHaveProperty('typicalSystems');
  });

  it('returns unknown for unrecognized type', () => {
    const domain = getL1('nonexistent_type_xyz');
    expect(domain.type).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    const domain = getL1('');
    expect(domain.type).toBe('unknown');
  });

  it('getAllL1Types returns expected types', () => {
    const types = getAllL1Types();
    expect(types).toContain('procurement');
    expect(types).toContain('unknown');
    expect(types.length).toBe(2);
  });

  it('getAllL1Domains returns full domain objects', () => {
    const domains = getAllL1Domains();
    expect(domains.length).toBe(2);
    expect(domains.every(d => d.typicalSteps.length > 0)).toBe(true);
  });
});
```

**Shared validation tests** (`src/__tests__/validations/process.test.ts`) — 9 tests:

```typescript
// 🆕v3 FIX22 + 🆕v4 FIX30, FIX33, FIX34: Tests for shared schemas + transitions + step parsing
import { describe, it, expect } from 'vitest';
import {
  createProcessSchema,
  updateProcessSchema,
  validateStatusTransition,
  parseProcessSteps,
} from '@/lib/validations/process';

describe('Process Validation Schemas', () => {
  it('createProcessSchema requires name', () => {
    const result = createProcessSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('createProcessSchema accepts valid input', () => {
    const result = createProcessSchema.safeParse({
      name: 'Purchasing',
      description: 'End-to-end procurement',
      departmentTag: 'Operations',
      knownSystems: ['SAP', 'Email'],
      knownPainPoints: 'Slow approvals',
    });
    expect(result.success).toBe(true);
  });

  it('createProcessSchema accepts minimal input', () => {
    const result = createProcessSchema.safeParse({ name: 'Purchasing' });
    expect(result.success).toBe(true);
  });

  it('updateProcessSchema rejects empty object', () => {
    const result = updateProcessSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // 🆕v4 FIX33: Explicit test that unknown fields are stripped
  it('updateProcessSchema strips unknown fields then rejects if empty', () => {
    // hypothesisText is not in schema → stripped by .strip() → empty → refine fails
    const result = updateProcessSchema.safeParse({ hypothesisText: 'hacked' });
    expect(result.success).toBe(false);
  });

  // 🆕v4 FIX30: Status transition tests
  it('validateStatusTransition allows draft → mapping', () => {
    expect(validateStatusTransition('draft', 'mapping').valid).toBe(true);
  });

  it('validateStatusTransition rejects draft → locked', () => {
    const result = validateStatusTransition('draft', 'locked');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot transition');
  });

  // 🆕v4 FIX34: Step parsing tests
  it('parseProcessSteps returns empty array for null/undefined', () => {
    expect(parseProcessSteps(null)).toEqual([]);
    expect(parseProcessSteps(undefined)).toEqual([]);
    expect(parseProcessSteps('not an array')).toEqual([]);
  });

  it('parseProcessSteps filters out malformed steps and sorts by order', () => {
    const raw = [
      { id: '1', name: 'Step B', description: 'B', order: 2, systems: [] },
      { bad: 'data' }, // malformed — should be filtered out
      { id: '2', name: 'Step A', description: 'A', order: 1, systems: [] },
    ];
    const result = parseProcessSteps(raw);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Step A'); // order 1 first
    expect(result[1].name).toBe('Step B'); // order 2 second
  });
});
```

**Query function tests** (`src/__tests__/db/process-queries.test.ts`) — 4 tests:

```typescript
// 🆕v3 FIX21: IMPORTANT — check pre-flight #11 to determine if this project
// uses vi.mock (mocked DB) or a real test database for query tests.
//
// 🆕v4 FIX31: The tests below mock at the QUERY FUNCTION level, not the
// raw db object. This is more reliable and matches how the functions are
// actually consumed by routes. If the project uses a real DB, convert these
// to integration tests with seed data and teardown instead.
//
// PATTERN A — Mock at query level (preferred if project uses mocks):
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Process Query Functions — Contract Tests', () => {
  // NOTE: If pre-flight #11 reveals a real test DB, replace these with:
  //   - beforeAll: run migrations, seed test data
  //   - afterAll: teardown
  //   - Test against real DB with real queries

  it('updateProcess exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.updateProcess).toBe('function');
  });

  it('updateProcessModel exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.updateProcessModel).toBe('function');
  });

  it('softDeleteProcess exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.softDeleteProcess).toBe('function');
  });

  it('getProcessWithModel exists and is a function', async () => {
    const queries = await import('@/lib/db/queries/processes');
    expect(typeof queries.getProcessWithModel).toBe('function');
  });
});

// ⚠️ IMPORTANT: The real coverage for these query functions comes from the
// API route tests in Step 3.3.7, which mock at a higher level and test
// the full request→query→response flow. These contract tests just ensure
// the functions exist with the right names after implementation.
```

**Run:** `npx vitest run` — expect 107 + 18 = **125 tests passing**.

---

## Step 3.2 — Hypothesis AI Function + Schema

**Goal:** Create the AI hypothesis generator following the company-research fire-and-forget pattern, adapted for per-user API keys.

| Action | File |
|--------|------|
| CREATE | `src/lib/ai/schemas/hypothesis.ts` — Zod schema for `generateObject` output |
| CREATE | `src/lib/ai/prompts/process-hypothesis.ts` — `generateHypothesis()` + `triggerProcessHypothesis()` |
| MODIFY | `src/lib/ai/get-ai-config.ts` — add `'hypothesis'` config entry if missing (🆕v6 FIX57) |
| CREATE | `src/__tests__/ai/process-hypothesis.test.ts` |

### 3.2.0 — Pre-implementation: Verify AI pattern from Phase 2

Before writing any code, read the Phase 2 company-research implementation:

```bash
cat src/lib/ai/prompts/company-research.ts
cat src/lib/ai/get-ai-config.ts
```

**Specifically verify:**
1. How `getAIConfig` receives the API key — does it take `apiKey` as a parameter? Or does it read from a user context?
2. How the fire-and-forget function receives the API key — is it passed as a parameter?
3. How the POST route extracts the API key from Clerk before calling the fire-and-forget.
4. 🆕v6 FIX57: What config keys are accepted? If `'hypothesis'` is not present, add it with the same model/token configuration as `'company-research'`.
5. 🆕v6 FIX58: What field name does the returned config use for max tokens? (`maxOutputTokens` vs `maxTokens` vs something else). Use the EXACT same field name in `generateObject` call below.

**Match the exact pattern.** If company-research passes the key as a function parameter, do the same here. If it uses a different mechanism, match it. Do NOT invent a new pattern.

### 3.2.1 — Zod Schema

```typescript
// src/lib/ai/schemas/hypothesis.ts
import { z } from 'zod';

export const hypothesisStepSchema = z.object({
  name: z.string().describe('Step name'),
  description: z.string().describe('What happens in this step'),
  systems: z.array(z.string()).describe('Systems likely involved'),
  order: z.number().int().positive().describe('Step order starting from 1'),
});

export const hypothesisSchema = z.object({
  hypothesisText: z.string().describe(
    'A 2-4 sentence hypothesis about how this process likely works, based on the company context and domain knowledge'
  ),
  matchedProcessType: z.string().describe(
    'The L1 process type that best matches (e.g., "procurement", "unknown")'
  ),
  initialSteps: z.array(hypothesisStepSchema).describe(
    'Ordered list of likely process steps'
  ),
});

export type HypothesisOutput = z.infer<typeof hypothesisSchema>;
export type HypothesisStep = z.infer<typeof hypothesisStepSchema>;
```

### 3.2.2 — AI Config Update 🆕v6 FIX57

```typescript
// MODIFY src/lib/ai/get-ai-config.ts — add 'hypothesis' entry if not present.
//
// After running pre-flight #20, if 'hypothesis' is NOT a recognized config key:
// Add it to the config map with the same model and token settings as 'company-research'.
//
// Example (adjust to match the actual file structure):
//
//   hypothesis: {
//     model: anthropic('claude-sonnet-4-20250514', { apiKey }),
//     maxOutputTokens: 4096,  // or maxTokens — match the field name used elsewhere
//   },
//
// 🆕v6 FIX58: Use the EXACT field name that generateObject expects.
// In AI SDK v4+, generateObject uses `maxTokens` (not maxOutputTokens).
// Check the company-research implementation to see which one is used.
// If company-research uses maxTokens → use maxTokens here too.
// The generateHypothesis function (3.2.3) will read whichever field this returns.
```

### 3.2.3 — Hypothesis Generator

```typescript
// src/lib/ai/prompts/process-hypothesis.ts
import { generateObject } from 'ai';
import { getAIConfig } from '../get-ai-config';
import { hypothesisSchema, type HypothesisOutput, type HypothesisStep } from '../schemas/hypothesis';
import { getAllL1Domains } from '@/lib/domain/l1';
import { updateProcess } from '@/lib/db/queries/processes';
import { updateProcessModel } from '@/lib/db/queries/processes';

// Full step shape written to JSONB in process_models.steps
interface ProcessStepFull {
  id: string;          // crypto.randomUUID() — available in Node 18.7+ and stable since Node 19
  name: string;
  description: string;
  order: number;
  systems: Array<{
    name: string;
    confirmed: boolean;  // default: false (AI-inferred)
    detailNotes: string; // default: '' (populated during Phase 5 shadowing)
  }>;
  confidence: 'inferred'; // always 'inferred' for AI-generated
  edgeCases: [];           // empty until shadowing
  notes: string;           // default: ''
}

function mapAIStepsToProcessSteps(aiSteps: HypothesisStep[]): ProcessStepFull[] {
  return aiSteps.map((step) => ({
    id: crypto.randomUUID(),
    name: step.name,
    description: step.description,
    order: step.order,
    systems: step.systems.map((s) => ({
      name: s,
      confirmed: false,
      detailNotes: '',
    })),
    confidence: 'inferred' as const,
    edgeCases: [],
    notes: '',
  }));
}

// apiKey is an explicit parameter — per-user key architecture
// Match the exact signature used in company-research.ts
export async function generateHypothesis(
  apiKey: string,
  input: {
    processName: string;
    processDescription?: string;
    companyName: string;
    companyIndustry?: string;
    companyWebsite?: string;
    departmentTag?: string;
    knownSystems?: string[];
    knownPainPoints?: string;
  }
): Promise<HypothesisOutput> {
  // 🆕v6 FIX57: 'hypothesis' config key must exist in get-ai-config.ts.
  // If pre-flight #20 showed it missing, you must add it before this line runs.
  const config = getAIConfig('hypothesis', apiKey);

  const allDomains = getAllL1Domains();

  // 🆕v6 FIX58: The field name below (maxOutputTokens vs maxTokens) MUST match
  // what getAIConfig returns AND what generateObject expects.
  // Check pre-flight #20. In AI SDK v4, the parameter is `maxTokens`.
  // If company-research uses `maxTokens`, change the line below accordingly.
  const { object } = await generateObject({
    model: config.model,
    schema: hypothesisSchema,
    maxTokens: config.maxTokens, // ← VERIFY: field name from getAIConfig (pre-flight #20)
    prompt: `You are an operations analyst helping map a business process.

Company: ${input.companyName}
${input.companyIndustry ? `Industry: ${input.companyIndustry}` : ''}
${input.companyWebsite ? `Website: ${input.companyWebsite}` : ''}

Process to analyze: "${input.processName}"
${input.processDescription ? `Description: ${input.processDescription}` : ''}
${input.departmentTag ? `Department: ${input.departmentTag}` : ''}
${input.knownSystems?.length ? `Known systems: ${input.knownSystems.join(', ')}` : ''}
${input.knownPainPoints ? `Known pain points: ${input.knownPainPoints}` : ''}

Available process type templates (pick the best match for matchedProcessType, or "unknown" if none fit):
${allDomains.map(d => `\n--- ${d.type} (${d.label}) ---\nTypical steps: ${d.typicalSteps.map(s => s.name).join(' → ')}\nCommon systems: ${d.commonSystems.join(', ') || 'none specified'}`).join('\n')}

Based on this context, generate:
1. A hypothesis about how this process likely works at this company
2. The best matching process type from the templates above
3. An ordered list of likely steps with the systems involved

Be specific to the company context. If you recognize the industry, tailor the steps accordingly.
If the process matches a known template, use it as a starting point but customize for this company.`,
  });

  return object;
}

// Fire-and-forget wrapper — matches company-research pattern
// apiKey is required parameter, NOT read from env
export function triggerProcessHypothesis(
  apiKey: string,
  processId: string,
  client: { name: string; industry?: string | null; website?: string | null },
  processInput: {
    name: string;
    description?: string;
    departmentTag?: string;
    knownSystems?: string[];
    knownPainPoints?: string;
  }
) {
  // 🆕v4 FIX32: Log start for debugging concurrent calls.
  // TODO Phase 4: Add hypothesisStatus column to prevent concurrent generation races.
  console.log(`[hypothesis] Starting generation for process ${processId}`);

  generateHypothesis(apiKey, {
    processName: processInput.name,
    processDescription: processInput.description,
    companyName: client.name,
    companyIndustry: client.industry ?? undefined,
    companyWebsite: client.website ?? undefined,
    departmentTag: processInput.departmentTag,
    knownSystems: processInput.knownSystems,
    knownPainPoints: processInput.knownPainPoints,
  })
    .then(async (result) => {
      await updateProcess(processId, {
        hypothesisText: result.hypothesisText,
        processTypeL1: result.matchedProcessType,
      });

      const fullSteps = mapAIStepsToProcessSteps(result.initialSteps);

      // 🆕v6 FIX56: updateProcessModel returns null if the model row doesn't exist.
      // This can happen if createProcessModel hasn't committed yet (fire-and-forget
      // race with the POST route) or if it failed. Retry once after a short delay.
      let modelResult = await updateProcessModel(processId, { steps: fullSteps });
      if (!modelResult) {
        console.warn(`[hypothesis] Model row not found for process ${processId}, retrying in 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        modelResult = await updateProcessModel(processId, { steps: fullSteps });
        if (!modelResult) {
          console.error(`[hypothesis] Model row still not found for process ${processId} after retry. Steps were NOT persisted. The user can regenerate later.`);
          return; // Don't throw — the hypothesis text was already saved
        }
      }

      console.log(`[hypothesis] Completed for process ${processId}: ${result.initialSteps.length} steps`);
    })
    .catch((err) => {
      console.error(`[hypothesis] Failed for process ${processId}:`, err);
      // 🆕v4: Update process with error state so UI can show failure
      updateProcess(processId, {
        hypothesisText: null, // remains null — UI can distinguish "never generated" from "generating"
      }).catch(() => {}); // swallow — nothing more we can do
    });
}
```

### 3.2.4 — Tests (5)

```typescript
// src/__tests__/ai/process-hypothesis.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock DB queries
vi.mock('@/lib/db/queries/processes', () => ({
  updateProcess: vi.fn().mockResolvedValue({}),
  updateProcessModel: vi.fn().mockResolvedValue({}),
}));

// Mock AI config
vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(() => ({
    model: 'mock-model',
    maxTokens: 4096, // 🆕v6 FIX58: Match the actual field name from getAIConfig
  })),
}));

import { generateObject } from 'ai';
import { updateProcess, updateProcessModel } from '@/lib/db/queries/processes';

describe('Process Hypothesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls generateObject with hypothesis schema and user API key', async () => {
    const { generateHypothesis } = await import('@/lib/ai/prompts/process-hypothesis');
    (generateObject as any).mockResolvedValue({
      object: {
        hypothesisText: 'Test hypothesis',
        matchedProcessType: 'procurement',
        initialSteps: [],
      },
    });

    await generateHypothesis('test-api-key', {
      processName: 'Purchasing',
      companyName: 'Acme Corp',
    });

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.any(Object),
        maxTokens: expect.any(Number), // 🆕v6 FIX58: verify correct field name
      })
    );
    const { getAIConfig } = await import('@/lib/ai/get-ai-config');
    expect(getAIConfig).toHaveBeenCalledWith('hypothesis', 'test-api-key');
  });

  it('triggerProcessHypothesis updates DB on success', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis');
    (generateObject as any).mockResolvedValue({
      object: {
        hypothesisText: 'This process likely...',
        matchedProcessType: 'procurement',
        initialSteps: [
          { name: 'Step 1', description: 'Do thing', systems: ['SAP'], order: 1 },
        ],
      },
    });

    triggerProcessHypothesis(
      'test-api-key',
      'process-123',
      { name: 'Acme Corp', industry: 'Manufacturing' },
      { name: 'Purchasing' }
    );

    await vi.waitFor(() => {
      expect(updateProcess).toHaveBeenCalledWith('process-123', expect.objectContaining({
        hypothesisText: 'This process likely...',
        processTypeL1: 'procurement',
      }));
      expect(updateProcessModel).toHaveBeenCalledWith('process-123', expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            name: 'Step 1',
            confidence: 'inferred',
            systems: expect.arrayContaining([
              expect.objectContaining({ name: 'SAP', confirmed: false }),
            ]),
          }),
        ]),
      }));
    });
  });

  it('maps AI steps to ProcessStepFull with correct defaults', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis');
    (generateObject as any).mockResolvedValue({
      object: {
        hypothesisText: 'Hypothesis',
        matchedProcessType: 'procurement',
        initialSteps: [
          { name: 'Step 1', description: 'Desc', systems: ['SAP', 'Email'], order: 1 },
        ],
      },
    });

    triggerProcessHypothesis(
      'test-api-key',
      'process-123',
      { name: 'Acme Corp' },
      { name: 'Purchasing' }
    );

    await vi.waitFor(() => {
      const steps = (updateProcessModel as any).mock.calls[0][1].steps;
      expect(steps[0]).toMatchObject({
        id: expect.any(String),
        name: 'Step 1',
        description: 'Desc',
        order: 1,
        confidence: 'inferred',
        edgeCases: [],
        notes: '',
        systems: [
          { name: 'SAP', confirmed: false, detailNotes: '' },
          { name: 'Email', confirmed: false, detailNotes: '' },
        ],
      });
    });
  });

  it('includes all L1 domain context in prompt', async () => {
    const { generateHypothesis } = await import('@/lib/ai/prompts/process-hypothesis');
    (generateObject as any).mockResolvedValue({
      object: {
        hypothesisText: 'Test',
        matchedProcessType: 'unknown',
        initialSteps: [],
      },
    });

    await generateHypothesis('test-api-key', {
      processName: 'Something',
      companyName: 'Test Corp',
    });

    const callArgs = (generateObject as any).mock.calls[0][0];
    expect(callArgs.prompt).toContain('procurement');
    expect(callArgs.prompt).toContain('unknown');
    expect(callArgs.prompt).toContain('Purchase Request Received');
  });

  it('handles generateObject errors gracefully', async () => {
    const { triggerProcessHypothesis } = await import('@/lib/ai/prompts/process-hypothesis');
    (generateObject as any).mockRejectedValue(new Error('API error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    triggerProcessHypothesis(
      'test-api-key',
      'process-123',
      { name: 'Acme Corp' },
      { name: 'Purchasing' }
    );

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[hypothesis] Failed'),
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
```

**Run:** `npx vitest run` — expect 125 + 5 = **130 tests passing**.

---

## Step 3.3 — Process API Routes

**Goal:** Build 6 endpoints following the contacts route pattern.

| Action | File |
|--------|------|
| CREATE | `src/lib/api/fetch-error.ts` — custom FetchError class 🆕v4 FIX25 |
| CREATE | `src/lib/ai/get-user-api-key.ts` (if not already existing) 🆕v4 FIX36 |
| CREATE | `src/app/api/clients/[id]/processes/route.ts` — GET list + POST create |
| CREATE | `src/app/api/clients/[id]/processes/[processId]/route.ts` — GET detail + PATCH + DELETE |
| CREATE | `src/app/api/clients/[id]/processes/[processId]/hypothesis/route.ts` — POST regenerate |
| CREATE | `src/__tests__/api/processes.test.ts` |
| CREATE | `src/__tests__/api/processes-id.test.ts` |
| CREATE | `src/__tests__/api/processes-hypothesis.test.ts` |

### 3.3.0 — Pre-implementation: Read existing route patterns

```bash
# Read the contacts route to match pattern exactly
cat src/app/api/clients/[id]/contacts/route.ts
cat src/app/api/clients/[id]/contacts/[contactId]/route.ts

# 🆕v4 FIX27: CRITICAL — check how contacts route verifies client ownership
# Does it call getClientById and check user access? Or does it just trust the URL param?
# We MUST replicate the EXACT same pattern.

# Read the company-research trigger route to match fire-and-forget + API key pattern
grep -r "triggerCompanyResearch" src/app/api/
# Note: how does the route extract the user's API key? Match that pattern.

# 🆕v5 FIX50: Read existing API route tests to understand the mock pattern
ls src/__tests__/api/
cat src/__tests__/api/clients.test.ts | head -80
# Specifically note:
# - How is NextRequest constructed?
# - How are auth helpers mocked?
# - How are DB queries mocked?
# - Are route handlers called directly or via a test client?
```

### 3.3.1 — FetchError class 🆕v4 FIX25

```typescript
// src/lib/api/fetch-error.ts
//
// 🆕v4 FIX25: Custom error class so SWR hooks can distinguish
// 401 (redirect to login) from 500 (show error state).

export class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}
```

### 3.3.2 — getUserApiKey helper 🆕v4 FIX36

```typescript
// 🆕v4 FIX36: If this helper doesn't exist yet (check pre-flight #12), create it.
// If it DOES exist, skip this file and import from the existing location.
//
// Location: src/lib/ai/get-user-api-key.ts
// Match the exact pattern used by company-research if it exists.

import { clerkClient } from '@clerk/nextjs/server';

/**
 * Extracts the user's Anthropic API key from Clerk privateMetadata.
 * Returns null if the user hasn't configured a key yet.
 *
 * MUST be called BEFORE the HTTP response is sent — Clerk auth context
 * is lost after the response returns.
 */
export async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const key = user.privateMetadata?.anthropicApiKey;
    return typeof key === 'string' && key.length > 0 ? key : null;
  } catch (err) {
    console.error(`[getUserApiKey] Failed to fetch key for user ${userId}:`, err);
    return null;
  }
}
```

### 3.3.3 — Auth Helper Pattern 🆕v3 FIX20

```typescript
// 🆕v3 FIX20: Document at the top of EVERY route file after running pre-flight #9.
//
// Pattern A — auth helpers RETURN null on failure:
//   const userId = requireUserId();
//   if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//
// Pattern B — auth helpers THROW on failure:
//   try {
//     const userId = requireUserId();
//   } catch {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }
//
// Pattern C — auth helpers return an object:
//   const { userId } = requireUserId();
//
// ALL route code below uses Pattern A. If pre-flight #9 reveals a different
// pattern, find-and-replace accordingly BEFORE implementation.
```

### 3.3.4 — List + Create Route

```typescript
// src/app/api/clients/[id]/processes/route.ts
//
// AUTH PATTERN: [fill in after pre-flight #9, e.g., "requireAdmin returns string | null"]

import { NextRequest, NextResponse } from 'next/server';
import { requireUserId, requireAdmin } from '@/lib/auth';
import { parseJSON } from '@/lib/api/utils';
import { getClientById } from '@/lib/db/queries/clients';
import {
  getProcessesByClientId,
  createProcess,
  createProcessModel,
  softDeleteProcess,
} from '@/lib/db/queries/processes';
import { triggerProcessHypothesis } from '@/lib/ai/prompts/process-hypothesis';
import { getUserApiKey } from '@/lib/ai/get-user-api-key';
import { createProcessSchema } from '@/lib/validations/process';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // 🆕v4 FIX27 + 🆕v5 FIX48 + 🆕v6 FIX61: Verify client exists AND user has access.
  // Match the exact ownership pattern from contacts route (pre-flight #16).
  // If contacts route has NO ownership check, this is the first place to add one.
  //
  // 🆕v6 FIX61: OWNERSHIP ENFORCEMENT — after reading pre-flight #16:
  // If getClientById already filters by orgId/userId internally → this is sufficient.
  // If NOT → you MUST add explicit ownership check here. Example:
  //   const client = await getClientById(id);
  //   if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  //   // If getClientById does NOT filter by org, add:
  //   // const userOrg = auth().orgId;
  //   // if (client.orgId !== userOrg) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  //
  // Replace the block below with the correct pattern from pre-flight #16.
  const client = await getClientById(id);
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const processes = await getProcessesByClientId(id);
  return NextResponse.json(processes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = requireAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Verify client exists BEFORE parsing body
  // 🆕v6 FIX61: Same ownership enforcement as GET above.
  const client = await getClientById(id);
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // 🆕v4 FIX28: parseJSON might throw or return null depending on implementation.
  // Wrap in try-catch as a safety net regardless.
  let body: any;
  try {
    body = await parseJSON(request);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = createProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // 🆕v4 FIX29: Wrap process + model creation together.
  // If model creation fails, clean up the process to avoid partial state.
  //
  // 🆕v5 FIX47: The field names passed to createProcess MUST match the function's
  // parameter type. Verify via pre-flight #18.
  //
  // 🆕v5 FIX53: knownSystems and knownPainPoints are intentionally NOT passed
  // to createProcess — they are AI-only context, not persisted in the DB.
  let process: any;
  try {
    process = await createProcess({
      clientId: id,
      name: parsed.data.name,
      description: parsed.data.description,
      departmentTag: parsed.data.departmentTag,
    });

    // Verify createProcessModel signature matches Phase 1 (pre-flight #2).
    await createProcessModel(process.id);
  } catch (err) {
    // If process was created but model failed, clean up
    if (process?.id) {
      await softDeleteProcess(process.id).catch(() => {});
    }
    console.error('[POST /processes] Failed to create process + model:', err);
    return NextResponse.json({ error: 'Failed to create process' }, { status: 500 });
  }

  // Extract API key BEFORE responding (Clerk context still available)
  const apiKey = await getUserApiKey(userId);

  // Fire-and-forget hypothesis generation
  // 🆕v6 FIX59: Track whether hypothesis was triggered for the response.
  let hypothesisTriggered = false;
  if (apiKey) {
    triggerProcessHypothesis(
      apiKey,
      process.id,
      { name: client.name, industry: client.industry, website: client.website },
      {
        name: parsed.data.name,
        description: parsed.data.description,
        departmentTag: parsed.data.departmentTag,
        knownSystems: parsed.data.knownSystems,
        knownPainPoints: parsed.data.knownPainPoints,
      }
    );
    hypothesisTriggered = true;
  } else {
    console.log(`[hypothesis] No API key for user ${userId}, skipping for process ${process.id}`);
  }

  // 🆕v6 FIX59: Include hypothesisTriggered flag so the client can show
  // appropriate feedback (e.g., "configure API key" toast vs "generating..." spinner).
  return NextResponse.json({ ...process, hypothesisTriggered }, { status: 201 });
}
```

### 3.3.5 — Detail + Update + Delete Route

```typescript
// src/app/api/clients/[id]/processes/[processId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserId, requireAdmin } from '@/lib/auth';
import { parseJSON } from '@/lib/api/utils';
import {
  getProcessById,
  getProcessWithModel,
  updateProcess,
  softDeleteProcess,
} from '@/lib/db/queries/processes';
import { updateProcessSchema, validateStatusTransition, type ProcessStatus } from '@/lib/validations/process';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const userId = requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, processId } = await params;

  const process = await getProcessWithModel(processId);
  if (!process) return NextResponse.json({ error: 'Process not found' }, { status: 404 });

  // IDOR check: verify process belongs to the client in the URL
  if (process.clientId !== id) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  return NextResponse.json(process);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const userId = requireAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, processId } = await params;

  let body: any;
  try {
    body = await parseJSON(request);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = updateProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify process exists and belongs to client
  const existing = await getProcessById(processId);
  if (!existing || existing.clientId !== id) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  // 🆕v4 FIX30: Validate status transitions if status is being changed
  if (parsed.data.status && parsed.data.status !== existing.status) {
    const transition = validateStatusTransition(
      existing.status as ProcessStatus,
      parsed.data.status
    );
    if (!transition.valid) {
      return NextResponse.json({ error: transition.error }, { status: 422 });
    }
  }

  const updated = await updateProcess(processId, parsed.data);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const userId = requireAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, processId } = await params;

  const existing = await getProcessById(processId);
  if (!existing || existing.clientId !== id) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  await softDeleteProcess(processId);

  // 🆕v4 FIX40: Return the deleted process ID so the client can
  // optimistically update the list cache without a full refetch.
  return NextResponse.json({ id: processId, message: 'Process deleted' });
}
```

### 3.3.6 — Hypothesis Regenerate Route 🆕v6 FIX66

```typescript
// src/app/api/clients/[id]/processes/[processId]/hypothesis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { parseJSON } from '@/lib/api/utils';
import { getProcessById } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';
import { triggerProcessHypothesis } from '@/lib/ai/prompts/process-hypothesis';
import { getUserApiKey } from '@/lib/ai/get-user-api-key';
import { regenerateHypothesisSchema } from '@/lib/validations/process';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; processId: string }> }
) {
  const userId = requireAdmin();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, processId } = await params;

  const process = await getProcessById(processId);
  if (!process || process.clientId !== id) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  const client = await getClientById(id);
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const apiKey = await getUserApiKey(userId);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No API key configured. Add your Anthropic API key in Settings.' },
      { status: 422 }
    );
  }

  // 🆕v6 FIX66: Accept optional body with knownSystems and knownPainPoints.
  // This allows users to provide updated AI context when regenerating.
  // Body is entirely optional — if not provided, only process name/description are used.
  let extraContext: { knownSystems?: string[]; knownPainPoints?: string } = {};
  try {
    const body = await parseJSON(request);
    if (body) {
      const parsed = regenerateHypothesisSchema.safeParse(body);
      if (parsed.success && parsed.data) {
        extraContext = parsed.data;
      }
      // Invalid body is silently ignored — regeneration proceeds without extra context
    }
  } catch {
    // No body or malformed JSON — proceed without extra context
  }

  triggerProcessHypothesis(
    apiKey,
    processId,
    { name: client.name, industry: client.industry, website: client.website },
    {
      name: process.name,
      description: process.description ?? undefined,
      knownSystems: extraContext.knownSystems,
      knownPainPoints: extraContext.knownPainPoints,
    }
  );

  return NextResponse.json({ message: 'Hypothesis generation started' });
}
```

### 3.3.7 — Tests (~26)

**🆕v5 FIX50: Template test file with full mocking patterns.**

The first test file (`processes.test.ts`) is provided in full as the **template** that the other two test files follow. The mocking patterns (auth, DB, request construction) established here MUST be used identically in `processes-id.test.ts` and `processes-hypothesis.test.ts`.

**⚠️ BEFORE writing these tests:** Run pre-flight #19. If the existing API tests use a different mocking pattern (e.g., a test client wrapper, or `supertest`), adapt ALL three files to match. Do NOT introduce a new test pattern.

**`src/__tests__/api/processes.test.ts`** — 9 tests (FULL TEMPLATE):

```typescript
// 🆕v5 FIX50: Full template test file with all mocking patterns.
// processes-id.test.ts and processes-hypothesis.test.ts follow this exact pattern.
//
// ⚠️ If pre-flight #19 reveals existing tests use a DIFFERENT pattern,
// adapt ALL three files to match. Do NOT introduce a new test pattern.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mock auth helpers ---
// Adjust this based on pre-flight #9 (does requireAdmin return null or throw?)
const mockRequireUserId = vi.fn();
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth', () => ({
  requireUserId: () => mockRequireUserId(),
  requireAdmin: () => mockRequireAdmin(),
}));

// --- Mock parseJSON ---
const mockParseJSON = vi.fn();
vi.mock('@/lib/api/utils', () => ({
  parseJSON: (req: any) => mockParseJSON(req),
}));

// --- Mock DB queries ---
const mockGetClientById = vi.fn();
vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: (id: string) => mockGetClientById(id),
}));

const mockGetProcessesByClientId = vi.fn();
const mockCreateProcess = vi.fn();
const mockCreateProcessModel = vi.fn();
const mockSoftDeleteProcess = vi.fn();
vi.mock('@/lib/db/queries/processes', () => ({
  getProcessesByClientId: (id: string) => mockGetProcessesByClientId(id),
  createProcess: (data: any) => mockCreateProcess(data),
  createProcessModel: (id: string) => mockCreateProcessModel(id),
  softDeleteProcess: (id: string) => mockSoftDeleteProcess(id),
}));

// --- Mock AI ---
const mockGetUserApiKey = vi.fn();
vi.mock('@/lib/ai/get-user-api-key', () => ({
  getUserApiKey: (userId: string) => mockGetUserApiKey(userId),
}));

const mockTriggerProcessHypothesis = vi.fn();
vi.mock('@/lib/ai/prompts/process-hypothesis', () => ({
  triggerProcessHypothesis: (...args: any[]) => mockTriggerProcessHypothesis(...args),
}));

// --- Import route handlers AFTER mocks are set up ---
import { GET, POST } from '@/app/api/clients/[id]/processes/route';

// --- Helper to create NextRequest ---
function createRequest(method: string, url: string, body?: any): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost'), init);
}

// --- Helper to create params (Next.js 15 Promise pattern) ---
function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

// --- Fake data ---
const fakeClient = { id: 'client-1', name: 'Acme Corp', industry: 'Manufacturing', website: 'https://acme.com' };
const fakeProcess = { id: 'proc-1', clientId: 'client-1', name: 'Purchasing', status: 'draft' };

describe('GET /api/clients/[id]/processes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockRequireUserId.mockReturnValue(null);
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes');
    const res = await GET(req, createParams({ id: 'client-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 for nonexistent client', async () => {
    mockRequireUserId.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(null);
    const req = createRequest('GET', 'http://localhost/api/clients/bad-id/processes');
    const res = await GET(req, createParams({ id: 'bad-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 200 with processes array for valid client', async () => {
    mockRequireUserId.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(fakeClient);
    mockGetProcessesByClientId.mockResolvedValue([fakeProcess]);
    const req = createRequest('GET', 'http://localhost/api/clients/client-1/processes');
    const res = await GET(req, createParams({ id: 'client-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Purchasing');
  });
});

describe('POST /api/clients/[id]/processes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 without admin auth', async () => {
    mockRequireAdmin.mockReturnValue(null);
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', { name: 'Test' });
    const res = await POST(req, createParams({ id: 'client-1' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent client', async () => {
    mockRequireAdmin.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(null);
    mockParseJSON.mockResolvedValue({ name: 'Test' });
    const req = createRequest('POST', 'http://localhost/api/clients/bad-id/processes', { name: 'Test' });
    const res = await POST(req, createParams({ id: 'bad-id' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing name', async () => {
    mockRequireAdmin.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(fakeClient);
    mockParseJSON.mockResolvedValue({});
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', {});
    const res = await POST(req, createParams({ id: 'client-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    mockRequireAdmin.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(fakeClient);
    mockParseJSON.mockRejectedValue(new SyntaxError('Unexpected token'));
    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes');
    const res = await POST(req, createParams({ id: 'client-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 with process and hypothesisTriggered=true when API key exists', async () => {
    mockRequireAdmin.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(fakeClient);
    mockParseJSON.mockResolvedValue({ name: 'Purchasing', description: 'Buy things' });
    mockCreateProcess.mockResolvedValue(fakeProcess);
    mockCreateProcessModel.mockResolvedValue({});
    mockGetUserApiKey.mockResolvedValue('sk-ant-test-key');

    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', {
      name: 'Purchasing',
      description: 'Buy things',
    });
    const res = await POST(req, createParams({ id: 'client-1' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Purchasing');
    // 🆕v6 FIX59: Verify hypothesisTriggered flag
    expect(body.hypothesisTriggered).toBe(true);

    expect(mockCreateProcessModel).toHaveBeenCalledWith('proc-1');
    expect(mockTriggerProcessHypothesis).toHaveBeenCalledWith(
      'sk-ant-test-key',
      'proc-1',
      expect.objectContaining({ name: 'Acme Corp' }),
      expect.objectContaining({ name: 'Purchasing' }),
    );
  });

  it('returns 201 with hypothesisTriggered=false when no API key', async () => {
    mockRequireAdmin.mockReturnValue('user-1');
    mockGetClientById.mockResolvedValue(fakeClient);
    mockParseJSON.mockResolvedValue({ name: 'Purchasing' });
    mockCreateProcess.mockResolvedValue(fakeProcess);
    mockCreateProcessModel.mockResolvedValue({});
    mockGetUserApiKey.mockResolvedValue(null); // no key

    const req = createRequest('POST', 'http://localhost/api/clients/client-1/processes', { name: 'Purchasing' });
    const res = await POST(req, createParams({ id: 'client-1' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    // 🆕v6 FIX59: Verify hypothesisTriggered flag
    expect(body.hypothesisTriggered).toBe(false);
    expect(mockTriggerProcessHypothesis).not.toHaveBeenCalled();
  });
});
```

**`src/__tests__/api/processes-id.test.ts`** — 11 tests:

Follow the EXACT same mocking pattern from `processes.test.ts`. Import `GET, PATCH, DELETE` from the `[processId]/route.ts` handler. Additional mocks needed:
- `mockGetProcessById`, `mockGetProcessWithModel`, `mockUpdateProcess`

| # | Test | Expected |
|---|------|----------|
| 1 | GET detail without auth | 401 |
| 2 | GET detail nonexistent process | 404 |
| 3 | GET detail with wrong clientId (IDOR) — `process.clientId !== id` | 404 |
| 4 | GET detail success | 200 + process with `.model` property |
| 5 | PATCH as viewer (requireAdmin returns null) | 403 |
| 6 | PATCH with empty body (refine rejects) | 400 |
| 7 | PATCH with malformed JSON (parseJSON throws) | 400 |
| 8 | PATCH nonexistent process | 404 |
| 9 | PATCH success — update name | 200 + updated process |
| 10 | PATCH invalid status transition (draft→locked) | 422 🆕v4 FIX30 |
| 11 | DELETE success | 200 + `{ id, message }` |

**Key mock setup for PATCH tests:**
```typescript
// For PATCH test #9 (success):
mockGetProcessById.mockResolvedValue({ ...fakeProcess, status: 'draft', clientId: 'client-1' });
mockParseJSON.mockResolvedValue({ name: 'Updated Name' });
mockUpdateProcess.mockResolvedValue({ ...fakeProcess, name: 'Updated Name' });

// For PATCH test #10 (invalid transition):
mockGetProcessById.mockResolvedValue({ ...fakeProcess, status: 'draft', clientId: 'client-1' });
mockParseJSON.mockResolvedValue({ status: 'locked' });
// Expect 422 — validateStatusTransition('draft', 'locked') returns invalid
```

**`src/__tests__/api/processes-hypothesis.test.ts`** — 6 tests:

Follow the EXACT same mocking pattern. Import `POST` from the `hypothesis/route.ts` handler.

| # | Test | Expected |
|---|------|----------|
| 1 | POST without auth (requireAdmin null) | 403 |
| 2 | POST nonexistent process | 404 |
| 3 | POST process belongs to different client (IDOR) | 404 |
| 4 | POST with no API key configured | 422 + error message |
| 5 | POST success triggers hypothesis | 200 + message |
| 6 | POST passes correct apiKey + client + process args to trigger | verify `mockTriggerProcessHypothesis` call args |

**Run:** `npx vitest run` — expect 130 + 26 = **156 tests passing**.

---

## Step 3.4 — SWR Hook + Process Creation Dialog + ProcessesSection Update

**Goal:** Wire up data fetching and process creation UI within the client overview.

| Action | File |
|--------|------|
| CREATE | `src/lib/hooks/use-processes.ts` — `useProcesses(clientId)`, `useProcess(clientId, processId)` |
| CREATE | `src/components/processes/create-process-dialog.tsx` |
| MODIFY | `src/components/clients/processes-section.tsx` — replace placeholder with real hook-driven list |
| MODIFY | `src/components/clients/client-overview.tsx` — pass `clientId` to ProcessesSection instead of processes array |
| CREATE | `src/app/(dashboard)/clients/[clientId]/processes/[processId]/page.tsx` — **stub only** |

### 3.4.1 — SWR Hooks 🆕v4 FIX25 + 🆕v5 FIX49 FIX52 + 🆕v6 FIX65 FIX67

```typescript
// src/lib/hooks/use-processes.ts
'use client'; // 🆕v5 FIX49: Required — this file exports React hooks (useSWR)

import useSWR from 'swr';
import { FetchError } from '@/lib/api/fetch-error';

// 🆕v5 FIX51 + 🆕v6 FIX67: Import the type from the queries file.
// If this causes build errors (Drizzle types pulling in server-only modules),
// replace with the manual interface defined in queries file comments.
import type { ProcessWithModel } from '@/lib/db/queries/processes';

// 🆕v4 FIX25: Typed fetcher that throws FetchError with status code.
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = typeof body.error === 'string' ? body.error : message;
    } catch {
      // Response body is not JSON — use default message
    }
    throw new FetchError(message, res.status);
  }
  return res.json();
}

// 🆕v5 FIX52: Process list items don't include the model join,
// so we type them separately. Adjust this type to match what
// getProcessesByClientId actually returns (check pre-flight #17).
interface ProcessListItem {
  id: string;
  name: string;
  status: string;
  departmentTag: string | null;
  clientId: string;
  description: string | null;
  hypothesisText: string | null;
  processTypeL1: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useProcesses(clientId: string) {
  const { data, error, isLoading, mutate } = useSWR<ProcessListItem[]>(
    clientId ? `/api/clients/${clientId}/processes` : null,
    fetcher<ProcessListItem[]>,
    {
      shouldRetryOnError: (err) => {
        if (err instanceof FetchError && [401, 403, 404].includes(err.status)) return false;
        return true;
      },
    }
  );

  return {
    processes: data ?? [],
    isLoading,
    error: error as FetchError | undefined,
    mutateProcesses: mutate,
  };
}

export function useProcess(clientId: string, processId: string) {
  const { data, error, isLoading, mutate } = useSWR<ProcessWithModel>(
    clientId && processId
      ? `/api/clients/${clientId}/processes/${processId}`
      : null,
    fetcher<ProcessWithModel>,
    {
      shouldRetryOnError: (err) => {
        if (err instanceof FetchError && [401, 403, 404].includes(err.status)) return false;
        return true;
      },
      // 🆕v6 FIX65: Disable revalidateOnFocus for the detail page.
      // HypothesisCard manages its own polling, and default SWR focus-revalidation
      // would cause unnecessary API calls every time the user switches tabs.
      revalidateOnFocus: false,
    }
  );

  return {
    process: data ?? null,
    isLoading,
    error: error as FetchError | undefined,
    mutateProcess: mutate,
  };
}
```

**⚠️ Import note on `ProcessWithModel`:** This type is exported from `@/lib/db/queries/processes` (a server-side file). Importing a TYPE from a server file into a `'use client'` file is fine in TypeScript — `import type` is erased at compile time and doesn't pull in server code. If you get a build error, switch to the manual interface defined in the comments of the queries file (🆕v6 FIX67).

### 3.4.2 — CreateProcessDialog 🆕v6 FIX59 FIX62

Fields:
- `name` (required text input)
- `departmentTag` (optional text input)
- `description` (optional textarea)
- `knownSystems` (optional text input — comma-separated, split to `string[]` before POST)
- `knownPainPoints` (optional textarea)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProcessSchema } from '@/lib/validations/process';
// 🆕v4 FIX37: Import toast from whichever library pre-flight #14 identifies.
import { toast } from 'sonner';
// Import shadcn Dialog, Button, Input, Textarea, Label from @/components/ui/...

interface CreateProcessDialogProps {
  clientId: string;
  mutateProcesses: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProcessDialog({
  clientId,
  mutateProcesses,
  open,
  onOpenChange,
}: CreateProcessDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentTag, setDepartmentTag] = useState('');
  const [knownSystems, setKnownSystems] = useState(''); // comma-separated string
  const [knownPainPoints, setKnownPainPoints] = useState('');

  // 🆕v6 FIX62: Reset form state when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Dialog is closing — reset all form state
      setName('');
      setDescription('');
      setDepartmentTag('');
      setKnownSystems('');
      setKnownPainPoints('');
      setErrors({});
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    setErrors({});
    setIsSubmitting(true);

    const formData = {
      name: name.trim(),
      description: description.trim() || undefined,
      departmentTag: departmentTag.trim() || undefined,
      knownSystems: knownSystems.trim()
        ? knownSystems.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      knownPainPoints: knownPainPoints.trim() || undefined,
    };

    // Client-side validation
    const parsed = createProcessSchema.safeParse(formData);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/clients/${clientId}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 201) {
        const newProcess = await res.json();

        // 🆕v6 FIX59: Use hypothesisTriggered flag from response instead of
        // checking for a separate 422 status (which the POST route never returns).
        if (newProcess.hypothesisTriggered) {
          toast.success('Process created — generating hypothesis...');
        } else {
          toast.info('Process created without hypothesis — configure your API key in Settings');
        }

        mutateProcesses();
        handleOpenChange(false);
        router.push(`/clients/${clientId}/processes/${newProcess.id}`);
      } else {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to create process');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Render shadcn Dialog with:
    // - open={open} onOpenChange={handleOpenChange} ← 🆕v6 FIX62: use handleOpenChange, NOT onOpenChange
    // - Input for name (show errors.name if present)
    // - Input for departmentTag
    // - Textarea for description
    // - Input for knownSystems (placeholder: "SAP, Email, Excel")
    // - Textarea for knownPainPoints
    // - Cancel + Submit buttons (Submit disabled while isSubmitting)
    // Match existing dialog patterns in the codebase.
    <></>
  );
}
```

### 3.4.3 — ProcessesSection Changes 🆕v4 FIX35

- Change props from `processes: Process[]` to `clientId: string`
- Use `useProcesses(clientId)` hook internally
- **Loading state:** Show skeleton loader while `isLoading`
- **🆕v4 FIX35 — Error state:** If `error`, show: "Failed to load processes. [Retry]" button that calls `mutateProcesses()`
- **Empty state:** "No processes yet. Create one to start mapping."
- Each item renders: name, status badge (ProcessStatusBadge), department tag (if set)
- Each item links to `/clients/${clientId}/processes/${process.id}`
- "Add Process" button (admin only via `useUser()` role check) opens CreateProcessDialog

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProcesses } from '@/lib/hooks/use-processes';
import { ProcessStatusBadge } from '@/components/processes/process-status-badge';
import { CreateProcessDialog } from '@/components/processes/create-process-dialog';
// Import Button, Skeleton from shadcn

interface ProcessesSectionProps {
  clientId: string;
}

export function ProcessesSection({ clientId }: ProcessesSectionProps) {
  const { processes, isLoading, error, mutateProcesses } = useProcesses(clientId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Skeleton loaders — match existing skeleton patterns in codebase */}
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="h-12 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-2">Failed to load processes.</p>
        <button
          onClick={() => mutateProcesses()}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Processes</h3>
        {/* TODO: wrap in admin-only check via useUser() role */}
        <button onClick={() => setDialogOpen(true)}>Add Process</button>
      </div>

      {processes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No processes yet. Create one to start mapping.
        </p>
      ) : (
        <div className="space-y-2">
          {processes.map((process) => (
            <Link
              key={process.id}
              href={`/clients/${clientId}/processes/${process.id}`}
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{process.name}</span>
                <ProcessStatusBadge status={process.status} />
              </div>
              {process.departmentTag && (
                <span className="text-xs text-muted-foreground">{process.departmentTag}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <CreateProcessDialog
        clientId={clientId}
        mutateProcesses={mutateProcesses}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
```

### 3.4.4 — client-overview.tsx Changes

```diff
- <ProcessesSection processes={client.processes ?? []} />
+ <ProcessesSection clientId={client.id} />
```

### 3.4.5 — Page Stub

```typescript
// src/app/(dashboard)/clients/[clientId]/processes/[processId]/page.tsx
// Stub — full implementation in Step 3.5
// This prevents 404 when CreateProcessDialog navigates after creation

export default function ProcessDetailPage() {
  return <div>Loading process...</div>;
}
```

**No new automated tests** — UI components; covered by manual verification. Verify manually:
- Navigate to a client → see ProcessesSection with "Add Process" button
- Dialog opens, form validates (try empty name → see error), form submits, navigates to stub page
- Process appears in list after navigating back
- API error → error state with retry button
- Open dialog, fill data, cancel, reopen → form is reset (🆕v6 FIX62)

---

## Step 3.5 — Process Detail Page + ProcessModel Flow

**Goal:** Build the process detail page with hypothesis display and step flow visualization.

| Action | File |
|--------|------|
| MODIFY | `src/app/(dashboard)/clients/[clientId]/processes/[processId]/page.tsx` — replace stub |
| CREATE | `src/components/processes/process-overview.tsx` — main orchestrator |
| CREATE | `src/components/processes/process-detail-card.tsx` — inline-editable metadata |
| CREATE | `src/components/processes/hypothesis-card.tsx` — hypothesis text + regenerate + auto-poll |
| CREATE | `src/components/processes/process-flow.tsx` — vertical step flow |
| CREATE | `src/components/processes/step-card.tsx` — individual step display |
| CREATE | `src/components/processes/process-status-badge.tsx` — draft/mapping/validated/locked |

### 3.5.1 — Page Layout

```typescript
// src/app/(dashboard)/clients/[clientId]/processes/[processId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ProcessOverview } from '@/components/processes/process-overview';

// 🆕v4 FIX41: Check pre-flight #15 for navigation pattern.
// If project uses breadcrumbs, use: <Breadcrumb items={[...]} />
// If project uses back links, use: <Link href={`/clients/${clientId}`}> ← Back to client</Link>
// Match whatever exists.

export default function ProcessDetailPage() {
  const params = useParams<{ clientId: string; processId: string }>();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Navigation element — match pre-flight #15 pattern */}
      <ProcessOverview clientId={params.clientId} processId={params.processId} />
    </div>
  );
}
```

### 3.5.2 — ProcessOverview 🆕v5 FIX54

```typescript
// src/components/processes/process-overview.tsx
'use client';

import { useProcess } from '@/lib/hooks/use-processes';
import { ProcessDetailCard } from './process-detail-card';
import { HypothesisCard } from './hypothesis-card';
import { ProcessFlow } from './process-flow';

interface ProcessOverviewProps {
  clientId: string;
  processId: string;
}

export function ProcessOverview({ clientId, processId }: ProcessOverviewProps) {
  const { process, isLoading, error, mutateProcess } = useProcess(clientId, processId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground mb-2">
          {error.status === 404 ? 'Process not found.' : 'Failed to load process.'}
        </p>
        {error.status !== 404 && (
          <button
            onClick={() => mutateProcess()}
            className="text-sm text-primary underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!process) {
    return <div className="text-center py-12 text-muted-foreground">Process not found.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{process.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-6">
          <ProcessDetailCard
            process={process}
            mutateProcess={mutateProcess}
            clientId={clientId}
          />
          <HypothesisCard
            process={process}
            mutateProcess={mutateProcess}
            clientId={clientId}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          <ProcessFlow process={process} />
        </div>
      </div>
    </div>
  );
}
```

### 3.5.3 — ProcessDetailCard 🆕v4 FIX39 + 🆕v6 FIX60

```typescript
// src/components/processes/process-detail-card.tsx
// 🆕v6 FIX60: Full component skeleton provided.
'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ProcessStatusBadge } from './process-status-badge';
import { VALID_TRANSITIONS, type ProcessStatus } from '@/lib/validations/process';
import type { ProcessWithModel } from '@/lib/db/queries/processes';
// Import Card, CardContent, CardHeader, Input, Textarea, Select from shadcn

interface ProcessDetailCardProps {
  process: ProcessWithModel;
  mutateProcess: (
    data?: any,
    opts?: { optimisticData?: any; rollbackOnError?: boolean; revalidate?: boolean }
  ) => Promise<any>;
  clientId: string;
}

export function ProcessDetailCard({ process, mutateProcess, clientId }: ProcessDetailCardProps) {
  // Inline-edit state — tracks which field is currently being edited
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Start editing a field — populate with current value
  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // 🆕v4 FIX39: Save with SWR optimistic update to prevent UI flicker
  const handleSave = useCallback(async (field: string, value: string) => {
    const patchData = { [field]: value || null }; // empty string → null for nullable fields
    const optimisticData = { ...process, [field]: value || null };

    setEditingField(null);

    try {
      await mutateProcess(
        async () => {
          const res = await fetch(
            `/api/clients/${clientId}/processes/${process.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patchData),
            }
          );
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update');
          }
          return res.json();
        },
        {
          optimisticData,
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }, [process, mutateProcess, clientId]);

  // Handle status change — uses dropdown, not inline text edit
  const handleStatusChange = useCallback(async (newStatus: string) => {
    const optimisticData = { ...process, status: newStatus };

    try {
      await mutateProcess(
        async () => {
          const res = await fetch(
            `/api/clients/${clientId}/processes/${process.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            }
          );
          if (!res.ok) {
            const err = await res.json();
            throw new Error(typeof err.error === 'string' ? err.error : 'Failed to update status');
          }
          return res.json();
        },
        {
          optimisticData,
          rollbackOnError: true,
          revalidate: false,
        }
      );
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }, [process, mutateProcess, clientId]);

  // Compute allowed transitions for the status dropdown
  const currentStatus = process.status as ProcessStatus;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

  return (
    // Card layout:
    //
    // <Card>
    //   <CardHeader> Process Details </CardHeader>
    //   <CardContent>
    //
    //     --- Name (click to edit) ---
    //     {editingField === 'name' ? (
    //       <Input value={editValue}
    //              onChange={e => setEditValue(e.target.value)}
    //              onBlur={() => handleSave('name', editValue)}
    //              onKeyDown={e => {
    //                if (e.key === 'Enter') handleSave('name', editValue);
    //                if (e.key === 'Escape') cancelEdit();
    //              }}
    //              autoFocus />
    //     ) : (
    //       <span onClick={() => startEdit('name', process.name)}
    //             className="cursor-pointer hover:bg-muted/50 px-1 rounded">
    //         {process.name}
    //       </span>
    //     )}
    //
    //     --- Status (dropdown, only shows valid transitions) ---
    //     <div className="flex items-center gap-2">
    //       <ProcessStatusBadge status={process.status} />
    //       {allowedTransitions.length > 0 && (
    //         <Select onValueChange={handleStatusChange}>
    //           {/* Options: only allowedTransitions */}
    //           {allowedTransitions.map(s => <option key={s} value={s}>{s}</option>)}
    //         </Select>
    //       )}
    //       {allowedTransitions.length === 0 && (
    //         <span className="text-xs text-muted-foreground">(locked)</span>
    //       )}
    //     </div>
    //
    //     --- Department (click to edit, nullable) ---
    //     {editingField === 'departmentTag' ? (
    //       <Input value={editValue}
    //              onChange={e => setEditValue(e.target.value)}
    //              onBlur={() => handleSave('departmentTag', editValue)}
    //              onKeyDown={e => {
    //                if (e.key === 'Enter') handleSave('departmentTag', editValue);
    //                if (e.key === 'Escape') cancelEdit();
    //              }}
    //              placeholder="Add department..."
    //              autoFocus />
    //     ) : (
    //       <span onClick={() => startEdit('departmentTag', process.departmentTag ?? '')}
    //             className="cursor-pointer hover:bg-muted/50 px-1 rounded">
    //         {process.departmentTag || 'No department'}
    //       </span>
    //     )}
    //
    //     --- Description (click to edit textarea, nullable) ---
    //     {editingField === 'description' ? (
    //       <Textarea value={editValue}
    //                 onChange={e => setEditValue(e.target.value)}
    //                 onBlur={() => handleSave('description', editValue)}
    //                 placeholder="Add description..."
    //                 autoFocus />
    //     ) : (
    //       <p onClick={() => startEdit('description', process.description ?? '')}
    //          className="cursor-pointer hover:bg-muted/50 px-1 rounded text-sm text-muted-foreground">
    //         {process.description || 'Click to add description...'}
    //       </p>
    //     )}
    //
    //     --- Process Type (read-only, set by AI) ---
    //     {process.processTypeL1 && (
    //       <span className="text-xs text-muted-foreground">
    //         Type: {process.processTypeL1}
    //       </span>
    //     )}
    //
    //   </CardContent>
    // </Card>
    <></>
  );
}
```

### 3.5.4 — HypothesisCard 🆕v4 FIX26 FIX38 + 🆕v6 FIX63

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import type { ProcessWithModel } from '@/lib/db/queries/processes';

interface HypothesisCardProps {
  process: ProcessWithModel;
  mutateProcess: () => Promise<any>;
  clientId: string;
}

export function HypothesisCard({ process, mutateProcess, clientId }: HypothesisCardProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // 🆕v6 FIX63: Track whether a regeneration was just triggered in this session.
  // This allows auto-poll to resume even for non-draft processes.
  const [justRegenerated, setJustRegenerated] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingActiveRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    pollingActiveRef.current = false;
    setIsPolling(false);
    setJustRegenerated(false);
  }, []);

  const startPolling = useCallback((checkFn: (data: any) => boolean) => {
    if (pollingActiveRef.current) return;
    pollingActiveRef.current = true;
    setIsPolling(true);
    setTimedOut(false);

    intervalRef.current = setInterval(async () => {
      if (!pollingActiveRef.current) return;
      try {
        const updated = await mutateProcess();
        if (updated && checkFn(updated)) {
          stopPolling();
        }
      } catch {
        // Swallow — will retry on next interval
      }
    }, 2000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setTimedOut(true);
    }, 30000);
  }, [mutateProcess, stopPolling]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Auto-poll when hypothesis is null on a fresh process OR after regeneration
  // 🆕v6 FIX63: Broadened condition — also poll if justRegenerated is true,
  // regardless of process status. This handles the case where user regenerates
  // hypothesis on a mapping/validated process and navigates away mid-generation.
  useEffect(() => {
    const shouldAutoPoll =
      (!process.hypothesisText && process.status === 'draft') || // fresh draft
      justRegenerated; // just triggered regeneration in this session

    if (!shouldAutoPoll) return;
    startPolling((data) => !!data.hypothesisText);
  }, [process.hypothesisText, process.status, justRegenerated, startPolling]);

  const handleRegenerate = useCallback(async () => {
    const res = await fetch(
      `/api/clients/${clientId}/processes/${process.id}/hypothesis`,
      { method: 'POST' }
    );

    if (res.status === 422) {
      toast.error('Configure your API key in Settings');
      return;
    }

    if (!res.ok) {
      toast.error('Failed to regenerate hypothesis');
      return;
    }

    toast.success('Hypothesis generation started');
    // 🆕v6 FIX63: Mark as just regenerated so auto-poll picks it up
    setJustRegenerated(true);
    const previousHypothesis = process.hypothesisText;
    startPolling((data) =>
      !!data.hypothesisText && data.hypothesisText !== previousHypothesis
    );
  }, [clientId, process.id, process.hypothesisText, startPolling]);

  return (
    // Card UI:
    // - If isPolling: show spinner + "Generating hypothesis..."
    // - If timedOut: show "Generation is taking longer than expected. Try regenerating."
    // - If process.hypothesisText: show hypothesis text
    // - If !process.hypothesisText && !isPolling && !timedOut:
    //     "No hypothesis generated yet. Configure your API key in Settings to enable AI features."
    // - Show process.processTypeL1 as a small badge if set
    // - Admin-only "Regenerate" button (disabled while isPolling)
    <></>
  );
}
```

### 3.5.5 — ProcessFlow 🆕v4 FIX34

```typescript
// src/components/processes/process-flow.tsx
'use client';

import { parseProcessSteps } from '@/lib/validations/process';
import { StepCard } from './step-card';
import type { ProcessWithModel } from '@/lib/db/queries/processes';

interface ProcessFlowProps {
  process: ProcessWithModel;
}

export function ProcessFlow({ process }: ProcessFlowProps) {
  const steps = parseProcessSteps(process.model?.steps);

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No steps yet. Generate a hypothesis to create initial steps.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <div key={step.id} className="relative">
          {index < steps.length - 1 && (
            <div className="absolute left-5 top-full w-0.5 h-4 bg-border" />
          )}
          <StepCard step={step} />
        </div>
      ))}
    </div>
  );
}
```

### 3.5.6 — StepCard

```typescript
// src/components/processes/step-card.tsx
'use client';

import { useState } from 'react';
import type { ProcessStepParsed } from '@/lib/validations/process';
import { SystemBadge } from './system-badge';

const confidenceColors = {
  confirmed: 'bg-green-100 text-green-700',
  inferred: 'bg-yellow-100 text-yellow-700',
  missing: 'bg-gray-100 text-gray-500',
};

interface StepCardProps {
  step: ProcessStepParsed;
}

export function StepCard({ step }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
          {step.order}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{step.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceColors[step.confidence]}`}>
              {step.confidence}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{step.description}</p>

          {step.systems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {step.systems.map((system) => (
                <SystemBadge key={system.name} systemName={system.name} entry={system} />
              ))}
            </div>
          )}

          {step.edgeCases.length > 0 && (
            <span className="text-xs text-muted-foreground mt-1 block">
              {step.edgeCases.length} edge case{step.edgeCases.length !== 1 ? 's' : ''}
            </span>
          )}

          {expanded && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {step.notes && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Notes</span>
                  <p className="text-sm">{step.notes}</p>
                </div>
              )}
              {step.edgeCases.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Edge Cases</span>
                  <ul className="text-sm list-disc list-inside">
                    {step.edgeCases.map((ec: any, i: number) => (
                      <li key={i}>{typeof ec === 'string' ? ec : ec.description ?? JSON.stringify(ec)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.5.7 — ProcessStatusBadge

```typescript
// src/components/processes/process-status-badge.tsx
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  mapping: 'bg-blue-100 text-blue-700',
  validated: 'bg-green-100 text-green-700',
  locked: 'bg-amber-100 text-amber-700',
};

interface ProcessStatusBadgeProps {
  status: string;
}

export function ProcessStatusBadge({ status }: ProcessStatusBadgeProps) {
  const colors = statusColors[status] ?? statusColors.draft;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors}`}>
      {status}
    </span>
  );
}
```

---

## Step 3.6 — System Badges with detailNotes Tooltip

**Goal:** Reusable system badge component with tooltip for detail notes.

| Action | File |
|--------|------|
| CREATE | `src/components/processes/system-badge.tsx` |

### 3.6.1 — Component

```typescript
// src/components/processes/system-badge.tsx
// Import Tooltip, TooltipContent, TooltipProvider, TooltipTrigger from shadcn
// Import Check icon from lucide-react

interface SystemEntry {
  name: string;
  confirmed: boolean;
  detailNotes: string;
}

interface SystemBadgeProps {
  systemName: string;
  entry?: SystemEntry;
}

export function SystemBadge({ systemName, entry }: SystemBadgeProps) {
  const badge = (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
      {systemName}
      {entry?.confirmed && (
        <span className="text-green-600">✓</span>
      )}
    </span>
  );

  if (entry?.detailNotes) {
    return (
      // shadcn Tooltip wrapping the badge
      // TooltipContent shows entry.detailNotes
      badge // Replace with proper Tooltip wrapper
    );
  }

  return badge;
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Per-user API key not available in fire-and-forget** | Hypothesis never generates | Extract key in route handler BEFORE response; pass as parameter |
| `updateProcess` doesn't exist | Runtime crash | Added in Step 3.1 with tests |
| AI SDK version uses different token field name | Build error or silent misconfiguration | Pre-flight #20 verifies exact field name 🆕v6 FIX58 |
| `'hypothesis'` not a valid getAIConfig key | Runtime crash | Pre-flight #20 verifies; add if missing 🆕v6 FIX57 |
| Nested params `{ id, processId }` from Promise | Runtime error | Explicit `await params` in every route handler |
| Process belongs to wrong client (IDOR) | Security | `process.clientId === clientId` ownership check in all routes |
| Fire-and-forget hypothesis leaves process without AI content | UX confusion | Auto-polling on first load + timeout message 🆕v4 FIX38 |
| L1 JSON import in edge runtime | Build error | Use TypeScript static import, not `fs.readFileSync` |
| GET detail doesn't include model/steps | Missing data on UI | `getProcessWithModel` LEFT JOIN |
| PATCH route has no validation | 500 on bad input | Explicit Zod schema with `.strip()` |
| Navigation to detail page before it exists | 404 | Stub page created in Step 3.4 |
| `processModels` might lack `deletedAt` column | Cascade fails | Pre-flight #4 verifies |
| `createProcessModel` signature mismatch | DB constraint error | Pre-flight #2 verifies signature |
| User manually edits hypothesisText via PATCH | Overwrites AI content | PATCH schema excludes AI-only fields |
| AI only sees "unknown" domain template | Poor hypothesis quality | Pass ALL L1 domains |
| `requireAdmin` throws vs returns null | 500 instead of 403 | Pre-flight #9 verifies; wrapper pattern provided |
| Query tests use wrong pattern | Inconsistent test suite | Pre-flight #11 checks existing pattern |
| Validation schemas stuck in server-only route files | Build error in client components | Moved to shared `src/lib/validations/process.ts` |
| `getProcessById` doesn't filter soft-deleted records | PATCH/DELETE on deleted processes | Pre-flight #1 verifies |
| No auto-poll on initial creation | User sees stale "No hypothesis" | useEffect auto-poll in HypothesisCard |
| **SWR fetcher throws generic Error** | Junior can't debug 401 vs 500 | `FetchError` class with status code 🆕v4 FIX25 |
| **Polling creates duplicate intervals** | Memory leak, rapid-fire requests | `useRef`-based polling with guard flag 🆕v4 FIX26 |
| **GET list doesn't check client ownership** | Any user enumerates any client's processes | Added `getClientById` check + ownership enforcement comments 🆕v4 FIX27 + 🆕v6 FIX61 |
| **`parseJSON` might throw** | 500 instead of 400 | try-catch wrapper in all routes 🆕v4 FIX28 |
| **createProcessModel failure leaves orphaned process** | Partial state in DB | try-catch with cleanup 🆕v4 FIX29 |
| **Status can skip transitions** | Workflow bypass | `VALID_TRANSITIONS` map + validation 🆕v4 FIX30 |
| **Concurrent hypothesis generation** | Two writes race | Documented as known limitation with TODO 🆕v4 FIX32 |
| **Zod strip behavior depends on parse mode** | Inconsistent validation | Explicit `.strip()` on schema 🆕v4 FIX33 |
| **JSONB steps could be null/malformed** | UI crash on `.map()` | `parseProcessSteps()` with Zod runtime validation 🆕v4 FIX34 |
| **No error state in ProcessesSection** | Silent failure | Error state with retry button 🆕v4 FIX35 |
| **`getUserApiKey` might not exist** | `MODULE_NOT_FOUND` at runtime | Fallback implementation provided 🆕v4 FIX36 |
| **Toast import unspecified** | Build error | Explicit `import { toast } from 'sonner'` 🆕v4 FIX37 |
| **Polling timeout is silent** | User confused by frozen UI | `timedOut` state with message 🆕v4 FIX38 |
| **Inline edit flickers** | Poor UX | SWR `optimisticData` + `rollbackOnError` 🆕v4 FIX39 |
| **DELETE response lacks ID** | Client can't optimistically remove item | Returns `{ id, message }` 🆕v4 FIX40 |
| **`getProcessesByClientId` returns deleted processes** | Deleted processes visible in list | Pre-flight #17 verifies soft-delete filter 🆕v5 FIX46 |
| **`createProcess` signature mismatch** | 500 on process creation | Pre-flight #18 verifies field names 🆕v5 FIX47 |
| **Client ownership check not defined** | Security gap or copy-paste confusion | Decision tree in pre-flight #16 🆕v5 FIX48 |
| **Missing `'use client'` on hooks file** | Build error | Added directive 🆕v5 FIX49 |
| **API route tests have no code template** | Junior blocked | Full template test file provided 🆕v5 FIX50 |
| **`ProcessWithModel` type undefined** | Type errors across UI | Exported from queries file 🆕v5 FIX51 |
| **SWR hooks untyped (`any`)** | Zero type safety in UI layer | Explicit type parameters on both hooks 🆕v5 FIX52 |
| **knownSystems/knownPainPoints silently discarded** | Junior thinks it's a bug | Documented as intentional 🆕v5 FIX53 |
| **`updateProcessModel` returns null silently** | Steps lost when model row doesn't exist yet | Null-check + single retry after 2s delay 🆕v6 FIX56 |
| **POST route 422 dead code in dialog** | Dialog handles status code route never returns | POST returns `hypothesisTriggered` flag; dialog uses it 🆕v6 FIX59 |
| **ProcessDetailCard has no skeleton** | Junior blocked on implementation | Full component skeleton with all fields 🆕v6 FIX60 |
| **Dialog doesn't reset form on close** | Stale data visible on reopen | State reset in `handleOpenChange` 🆕v6 FIX62 |
| **Auto-poll only fires on draft status** | Regeneration on mapping/validated status doesn't auto-poll | `justRegenerated` flag broadens condition 🆕v6 FIX63 |
| **Soft-delete cascade re-stamps already-deleted models** | Inconsistent timestamps | Added `isNull(processModels.deletedAt)` filter 🆕v6 FIX64 |
| **SWR revalidateOnFocus conflicts with manual polling** | Unnecessary API calls on tab-switch | `revalidateOnFocus: false` on detail hook 🆕v6 FIX65 |
| **Regenerate route accepts no context** | User can't update AI context on regeneration | Optional body parsing for knownSystems/knownPainPoints 🆕v6 FIX66 |
| **ProcessWithModel type may cause build errors** | Drizzle types pull server-only modules | Manual interface fallback provided in comments 🆕v6 FIX67 |

---

## Verification Plan

1. **Tests:** `npx vitest run` — expect **~156 tests passing** (107 existing + ~49 new)
2. **Build:** `npm run build` — must pass clean
3. **TypeScript:** `npx tsc --noEmit` — zero type errors
4. **Manual flow:**
   - Navigate to a client → see ProcessesSection with "Add Process" button
   - Create a process → redirected to process detail page
   - Toast shows "generating hypothesis..." if API key configured, or "configure API key" if not (🆕v6 FIX59)
   - Process detail shows metadata card, hypothesis card (auto-polling spinner → populated after 2-5s), step flow
   - Regenerate hypothesis → toast + hypothesis updates via polling (works on any status, not just draft — 🆕v6 FIX63)
   - Edit process name/status inline → persists immediately (optimistic), confirmed after refresh
   - Status dropdown only shows valid transitions (draft can't go to locked)
   - Delete process → redirected back to client, list updates
   - Open dialog, fill data, cancel, reopen → form is reset (🆕v6 FIX62)
5. **Edge cases to verify manually:**
   - Create process without API key → process created, no hypothesis, toast explains why, no crash
   - Create process with invalid body → 400 with field errors shown inline
   - Access process with wrong clientId in URL → 404 (not 403, to avoid ID enumeration)
   - PATCH with empty object → 400 "At least one field must be provided"
   - PATCH with `hypothesisText` in body → 400 (field stripped, refine rejects)
   - PATCH status draft→locked → 422 with transition error message
   - GET process that was soft-deleted → 404
   - Regenerate hypothesis without API key → 422 with helpful message
   - First load of new process → auto-poll shows loading indicator, then hypothesis appears
   - Polling timeout after 30s → shows "taking longer than expected" message
   - API returns 500 → ProcessesSection shows error state with retry button
   - Malformed steps in JSONB → ProcessFlow shows empty state, doesn't crash
   - Tab switch during polling → no duplicate API calls (🆕v6 FIX65)

---

## File Index (all files touched)

**CREATE (21 source files):** 🆕v5 FIX55 (confirmed accurate in v6)
- `src/lib/domain/l1/procurement.json`
- `src/lib/domain/l1/unknown.json`
- `src/lib/domain/l1/index.ts`
- `src/lib/validations/process.ts`
- `src/lib/api/fetch-error.ts`
- `src/lib/ai/get-user-api-key.ts` (if not already existing)
- `src/lib/ai/schemas/hypothesis.ts`
- `src/lib/ai/prompts/process-hypothesis.ts`
- `src/app/api/clients/[id]/processes/route.ts`
- `src/app/api/clients/[id]/processes/[processId]/route.ts`
- `src/app/api/clients/[id]/processes/[processId]/hypothesis/route.ts`
- `src/lib/hooks/use-processes.ts`
- `src/components/processes/create-process-dialog.tsx`
- `src/app/(dashboard)/clients/[clientId]/processes/[processId]/page.tsx`
- `src/components/processes/process-overview.tsx`
- `src/components/processes/process-detail-card.tsx`
- `src/components/processes/hypothesis-card.tsx`
- `src/components/processes/process-flow.tsx`
- `src/components/processes/step-card.tsx`
- `src/components/processes/process-status-badge.tsx`
- `src/components/processes/system-badge.tsx`

**CREATE (7 test files):**
- `src/__tests__/domain/l1-loader.test.ts`
- `src/__tests__/validations/process.test.ts`
- `src/__tests__/db/process-queries.test.ts`
- `src/__tests__/ai/process-hypothesis.test.ts`
- `src/__tests__/api/processes.test.ts`
- `src/__tests__/api/processes-id.test.ts`
- `src/__tests__/api/processes-hypothesis.test.ts`

**MODIFY (4 files):** (🆕v6: +1 from v5 due to get-ai-config.ts)
- `src/lib/db/queries/processes.ts` — add `updateProcess()`, `updateProcessModel()`, `softDeleteProcess()`, `getProcessWithModel()`, export `ProcessWithModel` type
- `src/lib/ai/get-ai-config.ts` — add `'hypothesis'` config entry if missing (🆕v6 FIX57)
- `src/components/clients/processes-section.tsx` — replace placeholder with hook-driven list
- `src/components/clients/client-overview.tsx` — pass `clientId` to ProcessesSection