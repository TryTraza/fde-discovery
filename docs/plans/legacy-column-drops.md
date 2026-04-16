# Plan: Drop legacy AI columns (post-Bloque 2 cleanup)

## Context

Bloque 1 of the AI redesign added structured JSONB columns alongside the
existing text/array columns. Bloque 2 made the new columns the primary
read path everywhere. The old columns are still in the database, still
being written, and still read by a small number of UI surfaces. This
plan retires them.

This is **not a feature PR**. It is a database hygiene PR that should
land after the new shapes have been observed running in production
unchanged for at least two weeks.

## Columns in scope

| Table | Legacy column | New column | Type of legacy data |
|---|---|---|---|
| `clients` | `ai_summary` (text) | `profile` (jsonb, `CompanyProfile`) | Free-form prose summary |
| `processes` | `hypothesis_text` (text) | `hypothesis` (jsonb, `ProcessHypothesis`) | Free-form prose hypothesis |
| `process_models` | `steps` (jsonb), `edge_cases` (jsonb), `systems` (jsonb) | `graph` (jsonb, `ProcessGraph`) | Three loosely-typed arrays |
| `research_notes` | `response` (text) | `response_structured` (jsonb, `ResearchNoteResult`) | Free-form chat reply |

Note: `research_notes.response` is a special case — the chat UI shows
the raw streamed reply to the user, and `response_structured` is the
distilled/categorised version. **Keep `response`.** Only the other
legacy columns are candidates for drop.

## Hard pre-conditions

Before opening this PR:

1. **At least 14 days** have passed since Bloque 2 was deployed to
   production.
2. **No incident** has required reverting any AI write path during that
   window. If there was one, restart the clock.
3. The branch passes `npm run test:run`, `npm run lint`, and `npm run build`
   on its own.
4. `drizzle-kit migrate` against staging applies cleanly with no manual
   intervention.

If any of these fail, **do not start**. The whole point of waiting is
to amortise the irreversibility of `DROP COLUMN`.

## Per-column workflow (apply identically to each)

### A. Code audit — confirm zero reads

For each `<col>` in scope:

```bash
# All TS/TSX references
grep -rn "<col>\|<camelCase>" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/lib/db/migrations/" \
  | grep -v "src/lib/db/schema.ts" \
  | grep -v "__tests__"
```

Acceptable hits:
- Type definitions (`Client.aiSummary?: string | null` will exist
  until the next `db:generate`).
- Drizzle migration snapshots (immutable history).

Unacceptable hits:
- Any `select`, `.aiSummary`, `client.aiSummary` access in app code.
- Any UI component rendering the value.

If hits remain, fix them in this PR before the migration step:
- Replace UI reads with the new column (e.g. `<AISummaryCard>` →
  `<CompanyProfileCard>`).
- Remove dual-write from any `update*` query function (e.g. drop
  `aiSummary: text` from the `triggerCompanyResearch` write).
- Delete the now-orphaned UI component if its content is fully
  replaced by the structured renderer.

### B. Schema removal

Edit `src/lib/db/schema.ts`:

```ts
// Before
export const clients = pgTable('clients', {
  ...
  aiSummary: text('ai_summary'),
  profile: jsonb('profile').$type<CompanyProfile>(),
  ...
})

// After
export const clients = pgTable('clients', {
  ...
  profile: jsonb('profile').$type<CompanyProfile>(),
  ...
})
```

Apply the same removal to `processes.hypothesisText`,
`processModels.steps`, `processModels.edgeCases`,
`processModels.systems`.

### C. Generate + apply migration

```bash
npm run db:generate -- --name=drop_legacy_ai_columns
```

Inspect the generated SQL:

```sql
ALTER TABLE "clients" DROP COLUMN "ai_summary";
ALTER TABLE "processes" DROP COLUMN "hypothesis_text";
ALTER TABLE "process_models" DROP COLUMN "steps";
ALTER TABLE "process_models" DROP COLUMN "edge_cases";
ALTER TABLE "process_models" DROP COLUMN "systems";
```

Verify:
- One `DROP COLUMN` per column above. No `DROP TABLE`.
- No new types or tables created (unrelated drift).
- No `CASCADE` keywords (we control everything that depends on these columns).

Apply locally first:

```bash
npm run db:migrate
```

Then run the full test suite:

```bash
npm run test:run
npm run build
```

### D. Cleanup of dead helpers

After the columns are gone:
- `src/lib/ai/graph/build-graph.ts` becomes unreachable from production
  code (the auto-derive in `updateProcessModel` no longer has legacy
  fields to derive from). Decide:
  - **Keep**: useful as documentation of the legacy → graph mapping;
    referenced by `scripts/backfill-process-graph.ts` for historical
    reruns.
  - **Delete**: cleaner, smaller surface. If the backfill script also
    goes, this is fine.

  Recommend keep until the backfill script is also retired (it will
  no-op against the new schema anyway since `steps`/`edge_cases`/
  `systems` won't exist).

- `scripts/backfill-process-graph.ts` becomes a no-op once those
  columns are gone. Either leave it (idempotent and self-skipping) or
  delete it. Recommend delete.

- `src/lib/db/types.ts` legacy interfaces (`ProcessStep`, `EdgeCase`,
  `SystemEntry`) — keep or trim per actual usage. They're harmless if
  unused.

### E. Update tests

- Any test fixture that includes a legacy column will start producing
  type errors against the new schema. Strip those fields from the
  fixtures.
- Search for `aiSummary`, `hypothesisText`, `steps:`, `edgeCases:`,
  `systems:` in `src/__tests__/` and remove the keys from object
  literals.

## Deployment

1. **Stage first.** Apply the migration on staging. Click through the
   app: client overview, process overview (graph render), session
   synthesis flow, research chat. Confirm no 500s and no broken UI.
2. **Backup.** Take a logical backup of the prod DB right before the
   migration. Neon has point-in-time recovery; confirm the recovery
   window covers at least the last 24 hours.
3. **Apply prod.** Run `npm run db:migrate` against prod (or via the
   deploy pipeline if one is wired). Watch error logs for 5 minutes.
4. **Smoke.** Same click-through as staging. Verify all four flows.

## Rollback

If something breaks after step 3:

1. Use Neon's point-in-time recovery to restore the columns. This is
   the only path — `ALTER TABLE ADD COLUMN` won't bring the data back
   (only the schema slot).
2. Revert the deploy.
3. Diagnose the failed read site, fix it, restart the clock on the
   14-day observation window.

This is why the pre-conditions matter. **The cost of being too eager
is restoring from backup. The cost of being too patient is some dead
columns sitting in the DB. Bias toward patience.**

## Verification checklist

- [ ] `grep -rn "ai_summary\|aiSummary" src/` returns only schema /
      migrations / tests.
- [ ] `grep -rn "hypothesis_text\|hypothesisText" src/` same.
- [ ] `grep -rn "steps:\|edgeCases:\|systems:" src/lib/db/schema.ts` —
      none of these fields appear on `processModels`.
- [ ] `npm run test:run` green.
- [ ] `npm run build` succeeds.
- [ ] `drizzle-kit migrate` no-ops on a freshly-cloned DB after the
      drop migration is applied.
- [ ] Staging click-through passes the 4 flows above.
- [ ] Prod backup confirmed before apply.
- [ ] Prod smoke passes after apply.

## Estimated scope

- ~5–8 small file edits (schema, a handful of components, a few
  fixtures).
- 1 generated migration file.
- 1 deleted UI component (`AISummaryCard`) if its render is fully
  replaced by `CompanyProfileCard`.
- ~30 minutes of focused work + 10 minutes of staging click-through.

This is the kind of PR you knock out in one sitting once the
14-day window has elapsed.
