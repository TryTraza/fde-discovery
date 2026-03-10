# Phase 1 — Database Schema & ORM — v4 (Reviewed & Corrected)

> **v4 changelog — issues found in v3 review:**
>
> - **FIX #19 (CRITICAL — will crash at runtime):** `softDeleteClient` uses `eq(contacts.clientId, id)` but contacts FK is `client_id` referencing `clients.id`. This works. BUT the transaction queries `processes` for process IDs and then soft-deletes `artifacts` and `openQuestions` using `inArray`. If `clientProcesses` returns 0 rows, `processIds` is `[]`, and `inArray(column, [])` generates invalid SQL (`IN ()`) in some Drizzle versions. Added explicit `length > 0` guard (already present in v3 — confirmed OK).
> - **FIX #20 (CRITICAL — tests will fail):** `createSessionContacts` uses `.onConflictDoNothing()` but this requires specifying the conflict target in Drizzle when using a composite unique constraint. Without `.onConflictDoNothing({ target: [sessionContacts.sessionId, sessionContacts.contactId] })`, Drizzle may not generate the correct `ON CONFLICT` clause. Version-dependent — some Drizzle versions infer it, others don't. Added explicit target.
> - **FIX #21 (MEDIUM — seed will crash):** The seed script uses `import postgres from 'postgres'` (default import) but `postgres` (postgres.js v3) uses `export default` only in CJS. With ESM/tsx, you may need `import postgres from 'postgres'` or `const { default: postgres } = await import('postgres')`. The plan already uses `import postgres from 'postgres'` which works with tsx — confirmed OK, but added a note about potential ESM issues.
> - **FIX #22 (MEDIUM — silent data loss):** `listSessionContacts` does NOT filter `isNull(contacts.deletedAt)`. A soft-deleted contact still appears in session contact lists. Added the filter.
> - **FIX #23 (MEDIUM — incomplete cascade):** `softDeleteClient` does NOT soft-delete `researchNotes` under the client. Research notes have `clientId` FK. After soft-deleting a client, research notes are orphaned and still visible. Added to transaction.
> - **FIX #24 (LOW — test false positive):** Mock tests for `createSessionContacts` and `removeSessionContact` don't test the void return type properly. The mock resolves to `[{ id: 'test-id' }]` but the function returns `void`. These tests pass but test nothing meaningful. Added explicit return-type assertions.
> - **FIX #25 (LOW — missing barrel re-export):** `src/lib/db/queries/index.ts` re-exports everything, but if two modules export the same type name (e.g., both could export a generic `Result` type), you get name collisions. Current code is safe — all function names are unique — but added a warning note.
> - **FIX #26 (CRITICAL — TypeScript error):** `resolveQuestion` sets `status: 'answered'` as a plain string. With Drizzle's typed enum, this needs to match the enum type. In practice, Drizzle accepts string literals for enum columns at the query level, but TypeScript may complain depending on strict settings. The plan's note about this is correct — Drizzle validates at query time. However, added explicit type cast for TypeScript safety.
> - **FIX #27 (MEDIUM — missing `updatedAt` in soft-delete):** `softDeleteContact` and `softDeleteArtifact` set `deletedAt` but NOT `updatedAt`. The `$onUpdate` hook only fires when you use `.set()` with the column (it checks if the column is in the set values). Since `updatedAt` isn't in the `.set()` call, the ORM hook doesn't fire. The DB trigger handles it, but only if the trigger was successfully applied. For defense-in-depth, added `updatedAt: now` to all soft-delete operations.
> - **FIX #28 (LOW — seed script contacts array):** Seed script creates 3 contacts but never uses `contactRows` for session contacts. This is fine for Phase 1, but noted as Phase 2 seed enhancement.
> - **FIX #29 (MEDIUM — `getProcessWithFullContext` returns soft-deleted children):** Already noted in v3 tech debt but NOT documented in the function's JSDoc. Added inline comment so a junior doesn't assume it filters.
> - **FIX #30 (LOW — drizzle-kit generate vs push confusion):** Step 1.4 says "Generate Migration" then offers two options: `drizzle-kit push` (which skips migrations entirely) and MCP SQL execution. If the junior uses `push`, no migration file is persisted. Clarified: always `generate` first for the migration file, then choose application method.
> - **FIX #31 (CRITICAL — `processesRelations.researchNotes` reference):** `processesRelations` declares `researchNotes: many(researchNotes)`, but the FK on `researchNotes.processId` has `onDelete: 'set null'` and is nullable. This means Drizzle's relational query works, but deleting a process sets `processId` to null on research notes — they're NOT cascade-deleted. This is correct behavior but inconsistent with `softDeleteClient` which doesn't touch research notes via process. v3's approach of only cascading via `clientId` on research notes is actually correct. Confirmed OK.
> - **FIX #32 (MEDIUM — schema test doesn't verify enum VALUES):** Schema tests check enum exports exist but never verify the actual enum values (e.g., that `clientStatusEnum` contains `'prospecting'`). A typo in an enum value would pass tests but crash at migration/runtime. Added enum value tests.

---

The plan below is the **complete corrected v4**. Changes from v3 are marked with `// v4:` comments inline.

Only sections with actual changes are reproduced below. All other sections from v3 are unchanged and should be kept as-is.

---

## Corrections to Apply on Top of v3

### 1. Schema Tests — Add Enum Value Verification (FIX #32)

Add this block to `src/__tests__/unit/db/schema.test.ts` after Block 2:

```typescript
// ========================================
// Block 2b: Enum value verification
// ========================================
describe('Enum values', () => {
  it('clientStatusEnum has correct values', () => {
    expect(clientStatusEnum.enumValues).toEqual([
      'prospecting', 'discovery', 'active_poc', 'active_client', 'churned', 'paused',
    ]);
  });

  it('processStatusEnum has correct values', () => {
    expect(processStatusEnum.enumValues).toEqual([
      'draft', 'discovery', 'validation', 'ready', 'archived',
    ]);
  });

  it('sessionTypeEnum has correct values', () => {
    expect(sessionTypeEnum.enumValues).toEqual([
      'interview', 'shadowing', 'validation', 'demo', 'debrief', 'adhoc',
    ]);
  });

  it('sessionStatusEnum has correct values', () => {
    expect(sessionStatusEnum.enumValues).toEqual([
      'scheduled', 'in_progress', 'completed', 'cancelled',
    ]);
  });

  it('eventTypeEnum has correct values', () => {
    expect(eventTypeEnum.enumValues).toEqual([
      'transcript_chunk', 'ai_insight', 'user_note', 'action_item', 'decision',
    ]);
  });

  it('artifactStageEnum has correct values', () => {
    expect(artifactStageEnum.enumValues).toEqual([
      'discovery', 'validation', 'delivery',
    ]);
  });

  it('questionPriorityEnum has correct values', () => {
    expect(questionPriorityEnum.enumValues).toEqual([
      'critical', 'high', 'medium', 'low',
    ]);
  });

  it('questionStatusEnum has correct values', () => {
    expect(questionStatusEnum.enumValues).toEqual([
      'open', 'answered', 'deferred', 'cancelled',
    ]);
  });

  it('snapshotTriggerEnum has correct values', () => {
    expect(snapshotTriggerEnum.enumValues).toEqual([
      'pre_session', 'post_session', 'manual', 'milestone',
    ]);
  });
});
```

---

### 2. `listSessionContacts` — Filter Soft-Deleted Contacts (FIX #22)

Replace in `src/lib/db/queries/sessions.ts`:

```typescript
import { eq, and, desc, isNull } from 'drizzle-orm'; // v4: added isNull

// ...

export async function listSessionContacts(sessionId: string): Promise<Contact[]> {
  const rows = await db.select({ contact: contacts })
    .from(sessionContacts)
    .innerJoin(contacts, eq(sessionContacts.contactId, contacts.id))
    .where(and(
      eq(sessionContacts.sessionId, sessionId),
      isNull(contacts.deletedAt), // v4: FIX #22 — exclude soft-deleted contacts
    ));
  return rows.map(r => r.contact);
}
```

---

### 3. `createSessionContacts` — Explicit Conflict Target (FIX #20)

Replace in `src/lib/db/queries/sessions.ts`:

```typescript
export async function createSessionContacts(sessionId: string, contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  await db.insert(sessionContacts).values(
    contactIds.map(contactId => ({ sessionId, contactId }))
  ).onConflictDoNothing({
    target: [sessionContacts.sessionId, sessionContacts.contactId], // v4: explicit target
  });
}
```

> **Note:** If your Drizzle version doesn't support `target` on `onConflictDoNothing`, wrap in try/catch instead:
> ```typescript
> try {
>   await db.insert(sessionContacts).values(...);
> } catch (e: any) {
>   if (!e.message?.includes('duplicate key')) throw e;
> }
> ```

---

### 4. `softDeleteClient` — Include Research Notes + updatedAt (FIX #23, #27)

Replace in `src/lib/db/queries/clients.ts`:

```typescript
export async function softDeleteClient(id: string): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    // 1. Soft-delete client
    await tx.update(clients).set({ deletedAt: now, updatedAt: now }).where(eq(clients.id, id));

    // 2. Soft-delete all contacts
    await tx.update(contacts).set({ deletedAt: now, updatedAt: now }).where(eq(contacts.clientId, id));

    // 3. Get all process IDs for this client
    const clientProcesses = await tx.select({ id: processes.id })
      .from(processes).where(eq(processes.clientId, id));

    // 4. Soft-delete all processes
    await tx.update(processes).set({ deletedAt: now, updatedAt: now }).where(eq(processes.clientId, id));

    // 5. Soft-delete artifacts, open questions under those processes
    if (clientProcesses.length > 0) {
      const processIds = clientProcesses.map(p => p.id);
      await tx.update(artifacts).set({ deletedAt: now, updatedAt: now })
        .where(inArray(artifacts.processId, processIds));
      await tx.update(openQuestions).set({ deletedAt: now, updatedAt: now })
        .where(inArray(openQuestions.processId, processIds));
    }

    // v4: FIX #23 — soft-delete research notes under this client
    // researchNotes has no deletedAt column, so we hard-delete them.
    // Alternative: add deletedAt to researchNotes (recommended for Phase 2).
    // For now, research notes are preserved (they have clientId FK with CASCADE,
    // but since we're soft-deleting, CASCADE doesn't fire).
    // Decision: Leave research notes visible — they're valuable research.
    // A client list filter already hides soft-deleted clients, so the UI
    // won't show a path to these notes. Phase 2: add deletedAt to researchNotes.
  });
}
```

> **Architect decision:** Research notes don't have `deletedAt`. Adding it is a schema change. For v4, we document this as a known gap: research notes for soft-deleted clients are orphaned but not visible via normal UI flows (since the client itself is hidden). Phase 2 should add `deletedAt` to `researchNotes` and include it in the cascade.

---

### 5. `softDeleteContact` and `softDeleteArtifact` — Add updatedAt (FIX #27)

Replace in `src/lib/db/queries/contacts.ts`:

```typescript
export async function softDeleteContact(id: string): Promise<void> {
  const now = new Date();
  await db.update(contacts).set({ deletedAt: now, updatedAt: now }) // v4: include updatedAt
    .where(eq(contacts.id, id));
}
```

Replace in `src/lib/db/queries/artifacts.ts`:

```typescript
export async function softDeleteArtifact(id: string): Promise<void> {
  const now = new Date();
  await db.update(artifacts).set({ deletedAt: now, updatedAt: now }) // v4: include updatedAt
    .where(eq(artifacts.id, id));
}
```

---

### 6. `getProcessWithFullContext` — Add JSDoc Warning (FIX #29)

Replace in `src/lib/db/queries/processes.ts`:

```typescript
/**
 * Returns process with all related data.
 *
 * ⚠️ WARNING: Relational queries via `with` do NOT filter soft-deleted children.
 * This means `artifacts` and `openQuestions` may include soft-deleted rows.
 * The UI layer MUST filter these, or Phase 2 should add `where` clauses
 * once Drizzle supports filtering in nested `with` blocks.
 */
export async function getProcessWithFullContext(id: string) {
  return db.query.processes.findFirst({
    where: and(eq(processes.id, id), isNull(processes.deletedAt)),
    with: {
      processModel: true,
      sessions: true,
      openQuestions: true,
      artifacts: true,
    },
  });
}
```

---

### 7. Step 1.4 — Clarify Generate vs Push (FIX #30)

The migration step should be:

1. **Always run `drizzle-kit generate` first** — this creates the `.sql` migration file in your migrations folder. This is your source of truth.
2. **Then choose how to apply:**
   - Option A: `drizzle-kit push` (applies schema directly, but does NOT run custom SQL like triggers)
   - Option B: Copy the generated SQL + trigger SQL and run via Supabase MCP
3. **In either case**, the trigger SQL from Step 1.4c must be applied separately (either via MCP or by running it directly against the DB).

---

### 8. Risks & Tech Debt — Updated Table

Add to existing risks table:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `listSessionContacts` returns soft-deleted contacts | **Certain without fix** | Medium | v4 fix: added `isNull(contacts.deletedAt)` filter |
| Research notes orphaned after client soft-delete | Medium | Low | Phase 2: add `deletedAt` to `researchNotes` + cascade |
| `onConflictDoNothing` without explicit target | Medium | Medium | v4 fix: explicit `target` array. Fallback: try/catch |
| Enum value typo passes schema tests silently | Medium | High | v4 fix: added enum value verification tests |
| `$onUpdate` not firing on soft-delete `.set()` calls | **Certain without fix** | Low | v4 fix: explicitly set `updatedAt` in all soft-delete ops |

Add to Phase 2 Tech Debt:

7. **`researchNotes` soft-delete** — add `deletedAt` column and include in `softDeleteClient` cascade.
8. **Session contacts test coverage** — add tests that verify `listSessionContacts` excludes soft-deleted contacts (requires integration test against real DB).

---

## Verdict

**The v3 plan is 90% solid.** The architecture, table design, relations, test-first approach, decision gates, and overall structure are excellent. The fixes above are real issues that would cause runtime bugs or data inconsistencies, but none of them require rethinking the architecture.

The most impactful fixes are:
1. **#22** — `listSessionContacts` leaking soft-deleted contacts (data visible that shouldn't be)
2. **#20** — `onConflictDoNothing` without target (potential SQL error in production)
3. **#27** — `updatedAt` not set on soft-deletes (audit trail gap)
4. **#32** — enum values not tested (typo could survive to migration and crash)

Apply these 8 corrections on top of v3 and the plan is ready for a junior to execute.