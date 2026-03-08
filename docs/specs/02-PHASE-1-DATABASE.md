# Phase 1 — Database Schema & ORM

**Goal:** All tables created via Drizzle, with `notes` on sessions and `detailNotes` on SystemEntry.
**Duration:** 2 days
**Gate:** All tables exist, seed script runs, query functions tested.

---

## Step 1.1 — Schema Changes from v1

Two key changes to the data model:

### Change 1: Session gets a `notes` field

The `sessions` table already had `transcript_text`. We add `notes` as a separate field. This allows the user to paste a Granola transcript AND write their own observations/notes independently. Both feed into synthesis.

```typescript
// In sessions table:
transcriptText: text('transcript_text'),   // Pasted from Granola or other tool
notes: text('notes'),                       // User's own notes/observations
```

### Change 2: SystemEntry JSONB gets `detailNotes`

The `SystemEntry` type (stored in `processModels.systems` JSONB) gets a free-text `detailNotes` field for capturing things like "Column A = Supplier Name, Sheet: Quotes2024, mapped from email subject line." In Phase 2 this becomes structured metadata.

```typescript
// SystemEntry schema:
export interface SystemEntry {
  name: string;
  confirmed: boolean;
  role: string;
  details: string;
  gaps: string;
  detailNotes: string;       // NEW: free-text for column mappings, sheet names, etc.
  sourceSessionId?: string;
}
```

---

## Step 1.2 — Full Schema

Create `src/lib/db/schema.ts`:

```typescript
import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum, date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// ==================== ENUMS ====================

export const clientStatusEnum = pgEnum('client_status', [
  'prospecting', 'active_poc', 'demo_ready', 'closed',
]);
export const processStatusEnum = pgEnum('process_status', [
  'draft', 'mapping', 'validated', 'locked',
]);
export const sessionTypeEnum = pgEnum('session_type', [
  'discovery', 'process_mapping', 'shadowing', 'validation', 'demo',
]);
export const sessionStatusEnum = pgEnum('session_status', [
  'planned', 'in_progress', 'completed',
]);
export const eventTypeEnum = pgEnum('event_type', [
  'STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION',
]);
export const artifactStageEnum = pgEnum('artifact_stage', [
  'input', 'intermediate', 'output', 'reference',
]);
export const questionPriorityEnum = pgEnum('question_priority', [
  'critical', 'important', 'nice_to_have',
]);
export const questionStatusEnum = pgEnum('question_status', [
  'open', 'sent', 'resolved',
]);
export const snapshotTriggerEnum = pgEnum('snapshot_trigger', [
  'synthesis_apply', 'validation_merge',
]);

// ==================== TABLES ====================

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  website: text('website'),
  hqLocation: text('hq_location'),
  notes: text('notes'),
  status: clientStatusEnum('status').default('prospecting').notNull(),
  aiSummary: text('ai_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  name: text('name').notNull(),
  role: text('role'),
  department: text('department'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const processes = pgTable('processes', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  name: text('name').notNull(),
  departmentTag: text('department_tag'),
  description: text('description'),
  status: processStatusEnum('status').default('draft').notNull(),
  hypothesisText: text('hypothesis_text'),
  processTypeL1: text('process_type_l1').default('unknown'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const processModels = pgTable('process_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id').notNull().references(() => processes.id).unique(),
  steps: jsonb('steps').default([]).notNull(),       // ProcessStep[]
  edgeCases: jsonb('edge_cases').default([]).notNull(), // EdgeCase[]
  systems: jsonb('systems').default([]).notNull(),     // SystemEntry[] — now with detailNotes
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const processModelSnapshots = pgTable('process_model_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  processModelId: uuid('process_model_id').notNull().references(() => processModels.id),
  trigger: snapshotTriggerEnum('trigger').notNull(),
  sessionId: uuid('session_id').references(() => sessions.id),
  state: jsonb('state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id').notNull().references(() => processes.id),
  type: sessionTypeEnum('type').notNull(),
  date: date('date').notNull(),
  status: sessionStatusEnum('status').default('planned').notNull(),
  interviewAnswers: jsonb('interview_answers'),
  prepBrief: jsonb('prep_brief'),
  transcriptText: text('transcript_text'),     // Pasted transcript (Granola, etc.)
  notes: text('notes'),                         // NEW: user's own notes/observations
  aiSummary: text('ai_summary'),
  synthesisOutput: jsonb('synthesis_output'),
  debriefAnswers: jsonb('debrief_answers'),
  shadowingConfig: jsonb('shadowing_config'),
  validationConfig: jsonb('validation_config'),
  demoConfig: jsonb('demo_config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const sessionContacts = pgTable('session_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  roleInSession: text('role_in_session'),
});

export const eventLogs = pgTable('event_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  type: eventTypeEnum('type').notNull(),
  label: text('label'),
  detail: text('detail'),
  suggestionUsed: boolean('suggestion_used').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const artifacts = pgTable('artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id').notNull().references(() => processes.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  sourceDescription: text('source_description'),
  label: text('label'),
  stage: artifactStageEnum('stage'),
  confirmed: boolean('confirmed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const openQuestions = pgTable('open_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id').notNull().references(() => processes.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  text: text('text').notNull(),
  priority: questionPriorityEnum('priority').notNull(),
  status: questionStatusEnum('status').default('open').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const researchNotes = pgTable('research_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  processId: uuid('process_id').references(() => processes.id),
  query: text('query').notNull(),
  response: text('response').notNull(),
  sources: jsonb('sources').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==================== RELATIONS ====================
// (Same as v1 — see 02-PHASE-1-DATABASE.md v1 for full relations)

// ==================== ZOD SCHEMAS & TYPES ====================

export const insertClientSchema = createInsertSchema(clients);
export const selectClientSchema = createSelectSchema(clients);
// ... repeat for all tables

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
// ... etc
```

---

## Step 1.3 — JSONB Type Definitions

Create `src/lib/db/types.ts`:

```typescript
// ==================== ProcessModel JSONB types ====================

export interface ProcessStep {
  id: string;
  order: number;
  name: string;
  description: string;
  confidence: 'confirmed' | 'inferred' | 'missing';
  sourceSessionId?: string;
  systems: string[];
  nextSteps: string[];
  branchCondition?: string | null;
  relatedEdgeCases: string[];
  notes: string;
}

export interface EdgeCase {
  id: string;
  description: string;
  frequency: 'rare' | 'occasional' | 'frequent' | 'unknown';
  suggestedHandling: string;
  status: 'open' | 'needs_clarification' | 'resolved';
  sourceSessionId?: string;
  relatedStepId?: string;
}

export interface SystemEntry {
  name: string;
  confirmed: boolean;
  role: string;
  details: string;
  gaps: string;
  detailNotes: string;          // NEW: free-text for column mappings, sheet names, etc.
                                 // e.g. "Sheet: Quotes2024, Col A=Supplier, Col B=Price,
                                 //       Col C=Currency. Mapped from email body."
                                 // Phase 2 will structure this into typed metadata.
  sourceSessionId?: string;
}

// ==================== Session JSONB types ====================

export interface InterviewAnswers {
  questions: Array<{ question: string; answer: string }>;
}

export interface PrepBrief {
  whatWeKnow: string;   // markdown
  whatsOpen: string;    // markdown
  suggestedFocus: string[];
}

export interface ShadowingConfig {
  personShadowedContactId: string;
  focusArea: 'full_flow' | 'specific_steps' | 'edge_cases_only';
  gapsToFill: string[];
}

export interface ValidationConfig {
  stepsToValidate: string[];
}

export interface DemoConfig {
  scenarios: string;
  knownEdgeCases: string;
}

export interface DebriefItem {
  eventLogId: string;
  type: 'question' | 'implicit';
  resolution: 'asked_answered' | 'described' | 'open_question' | 'skipped';
  answer?: string;
  description?: string;
  priority?: 'critical' | 'important' | 'nice_to_have';
  openQuestionCreated: boolean;
  openQuestionId?: string;
}

export interface DebriefAnswers {
  items: DebriefItem[];
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
}
```

---

## Steps 1.4–1.6 — Migrations, Query Layer, Seed

Same as v1 — generate migrations, push to Supabase, create query files for each entity, create seed script. The only query difference is the session queries now include the `notes` field.

### Phase 1 Gate Checklist

- [ ] All tables exist in Supabase (verify with `drizzle-kit studio`)
- [ ] `sessions` table has both `transcript_text` and `notes` columns
- [ ] `SystemEntry` type includes `detailNotes` field
- [ ] Schema test passes
- [ ] Seed script runs
- [ ] All query files created
