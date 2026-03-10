# Phase 1 — Database Schema & ORM

**Goal:** All 11 tables created via Drizzle ORM with migrations applied to Supabase. Type-safe query functions for every entity. JSONB types defined. Seed data for development.
**Duration:** 2 days
**Gate:** All tables exist in Supabase, seed script populates test data, all query functions tested.

---

## Step 1.1 — Write Tests First

Create `src/__tests__/unit/db/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schema from '@/lib/db/schema';

describe('Database Schema — Tables', () => {
  it('exports all 11 tables', () => {
    const tables = [
      'clients', 'contacts', 'processes', 'processModels',
      'processModelSnapshots', 'sessions', 'sessionContacts',
      'eventLogs', 'artifacts', 'openQuestions', 'researchNotes',
    ];
    for (const t of tables) {
      expect((schema as any)[t]).toBeDefined();
    }
  });
});

describe('Database Schema — Enums', () => {
  it('exports all 9 enums', () => {
    const enums = [
      'clientStatusEnum', 'processStatusEnum', 'sessionTypeEnum',
      'sessionStatusEnum', 'eventTypeEnum', 'artifactStageEnum',
      'questionPriorityEnum', 'questionStatusEnum', 'snapshotTriggerEnum',
    ];
    for (const e of enums) {
      expect((schema as any)[e]).toBeDefined();
    }
  });
});

describe('Database Schema — Column Verification', () => {
  it('clients table has all columns', () => {
    const cols = Object.keys(schema.clients);
    const expected = ['id', 'name', 'industry', 'website', 'hqLocation',
      'notes', 'status', 'aiSummary', 'createdAt', 'updatedAt', 'deletedAt'];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('contacts table has all columns', () => {
    const cols = Object.keys(schema.contacts);
    const expected = ['id', 'clientId', 'name', 'role', 'department',
      'email', 'phone', 'notes', 'createdAt', 'updatedAt', 'deletedAt'];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('processes table has all columns', () => {
    const cols = Object.keys(schema.processes);
    const expected = ['id', 'clientId', 'name', 'departmentTag', 'description',
      'status', 'hypothesisText', 'processTypeL1', 'createdAt', 'updatedAt', 'deletedAt'];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('processModels table has steps, edgeCases, systems as JSONB', () => {
    const cols = Object.keys(schema.processModels);
    expect(cols).toContain('processId');
    expect(cols).toContain('steps');
    expect(cols).toContain('edgeCases');
    expect(cols).toContain('systems');
  });

  it('sessions table has transcriptText AND notes', () => {
    const cols = Object.keys(schema.sessions);
    expect(cols).toContain('transcriptText');
    expect(cols).toContain('notes');
  });

  it('sessions table has all JSONB config columns', () => {
    const cols = Object.keys(schema.sessions);
    const jsonbCols = ['interviewAnswers', 'prepBrief', 'synthesisOutput',
      'debriefAnswers', 'shadowingConfig', 'validationConfig', 'demoConfig'];
    for (const c of jsonbCols) expect(cols).toContain(c);
  });

  it('eventLogs table has type, label, detail, suggestionUsed', () => {
    const cols = Object.keys(schema.eventLogs);
    for (const c of ['type', 'label', 'detail', 'suggestionUsed']) {
      expect(cols).toContain(c);
    }
  });

  it('artifacts table has all file-related columns', () => {
    const cols = Object.keys(schema.artifacts);
    for (const c of ['filename', 'storagePath', 'fileSizeBytes', 'mimeType', 'stage', 'confirmed']) {
      expect(cols).toContain(c);
    }
  });

  it('openQuestions table has priority, status, resolvedAt', () => {
    const cols = Object.keys(schema.openQuestions);
    for (const c of ['priority', 'status', 'resolvedAt', 'resolutionNotes']) {
      expect(cols).toContain(c);
    }
  });
});

describe('Database Schema — Types', () => {
  it('exports insert and select Zod schemas for all main tables', () => {
    expect(schema.insertClientSchema).toBeDefined();
    expect(schema.selectClientSchema).toBeDefined();
    expect(schema.insertContactSchema).toBeDefined();
    expect(schema.selectContactSchema).toBeDefined();
    expect(schema.insertProcessSchema).toBeDefined();
    expect(schema.selectProcessSchema).toBeDefined();
    expect(schema.insertSessionSchema).toBeDefined();
    expect(schema.selectSessionSchema).toBeDefined();
    expect(schema.insertEventLogSchema).toBeDefined();
    expect(schema.insertArtifactSchema).toBeDefined();
    expect(schema.insertOpenQuestionSchema).toBeDefined();
    expect(schema.insertResearchNoteSchema).toBeDefined();
  });
});
```

**Run: `npm run test` → should FAIL (schema.ts doesn't exist yet).**

---

## Step 1.2 — Define Complete Schema

Create `src/lib/db/schema.ts`:

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// ====================================================================
// ENUMS — 9 total
// ====================================================================

export const clientStatusEnum = pgEnum('client_status', [
  'prospecting',
  'active_poc',
  'demo_ready',
  'closed',
]);

export const processStatusEnum = pgEnum('process_status', [
  'draft',
  'mapping',
  'validated',
  'locked',
]);

export const sessionTypeEnum = pgEnum('session_type', [
  'discovery',
  'process_mapping',
  'shadowing',
  'validation',
  'demo',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'planned',
  'in_progress',
  'completed',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'STEP',
  'EDGE',
  'SYSTEM',
  'IMPLICIT',
  'QUESTION',
]);

export const artifactStageEnum = pgEnum('artifact_stage', [
  'input',
  'intermediate',
  'output',
  'reference',
]);

export const questionPriorityEnum = pgEnum('question_priority', [
  'critical',
  'important',
  'nice_to_have',
]);

export const questionStatusEnum = pgEnum('question_status', [
  'open',
  'sent',
  'resolved',
]);

export const snapshotTriggerEnum = pgEnum('snapshot_trigger', [
  'synthesis_apply',
  'validation_merge',
]);

// ====================================================================
// TABLES — 11 total
// ====================================================================

// TABLE 1: clients
export const clients = pgTable('clients', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        text('name').notNull(),
  industry:    text('industry').notNull(),
  website:     text('website'),
  hqLocation:  text('hq_location'),
  notes:       text('notes'),
  status:      clientStatusEnum('status').default('prospecting').notNull(),
  aiSummary:   text('ai_summary'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 2: contacts
export const contacts = pgTable('contacts', {
  id:          uuid('id').defaultRandom().primaryKey(),
  clientId:    uuid('client_id').notNull().references(() => clients.id),
  name:        text('name').notNull(),
  role:        text('role'),
  department:  text('department'),
  email:       text('email'),
  phone:       text('phone'),
  notes:       text('notes'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 3: processes
export const processes = pgTable('processes', {
  id:              uuid('id').defaultRandom().primaryKey(),
  clientId:        uuid('client_id').notNull().references(() => clients.id),
  name:            text('name').notNull(),
  departmentTag:   text('department_tag'),
  description:     text('description'),
  status:          processStatusEnum('status').default('draft').notNull(),
  hypothesisText:  text('hypothesis_text'),
  processTypeL1:   text('process_type_l1').default('unknown'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 4: process_models (one-to-one with processes)
export const processModels = pgTable('process_models', {
  id:          uuid('id').defaultRandom().primaryKey(),
  processId:   uuid('process_id').notNull().references(() => processes.id).unique(),
  steps:       jsonb('steps').default([]).notNull(),       // ProcessStep[]
  edgeCases:   jsonb('edge_cases').default([]).notNull(),   // EdgeCase[]
  systems:     jsonb('systems').default([]).notNull(),      // SystemEntry[]
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// TABLE 5: process_model_snapshots (internal backups, no UI)
export const processModelSnapshots = pgTable('process_model_snapshots', {
  id:              uuid('id').defaultRandom().primaryKey(),
  processModelId:  uuid('process_model_id').notNull().references(() => processModels.id),
  trigger:         snapshotTriggerEnum('trigger').notNull(),
  sessionId:       uuid('session_id').references(() => sessions.id),
  state:           jsonb('state').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// TABLE 6: sessions
export const sessions = pgTable('sessions', {
  id:                uuid('id').defaultRandom().primaryKey(),
  processId:         uuid('process_id').notNull().references(() => processes.id),
  type:              sessionTypeEnum('type').notNull(),
  date:              date('date').notNull(),
  status:            sessionStatusEnum('status').default('planned').notNull(),
  interviewAnswers:  jsonb('interview_answers'),       // InterviewAnswers
  prepBrief:         jsonb('prep_brief'),               // PrepBrief
  transcriptText:    text('transcript_text'),            // Pasted from Granola or recording tool
  notes:             text('notes'),                      // User's own notes/observations
  aiSummary:         text('ai_summary'),
  synthesisOutput:   jsonb('synthesis_output'),
  debriefAnswers:    jsonb('debrief_answers'),           // DebriefAnswers
  shadowingConfig:   jsonb('shadowing_config'),          // ShadowingConfig
  validationConfig:  jsonb('validation_config'),         // ValidationConfig
  demoConfig:        jsonb('demo_config'),               // DemoConfig
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:         timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 7: session_contacts (many-to-many join)
export const sessionContacts = pgTable('session_contacts', {
  id:            uuid('id').defaultRandom().primaryKey(),
  sessionId:     uuid('session_id').notNull().references(() => sessions.id),
  contactId:     uuid('contact_id').notNull().references(() => contacts.id),
  roleInSession: text('role_in_session'),
});

// TABLE 8: event_logs (shadowing capture events)
export const eventLogs = pgTable('event_logs', {
  id:              uuid('id').defaultRandom().primaryKey(),
  sessionId:       uuid('session_id').notNull().references(() => sessions.id),
  timestamp:       timestamp('timestamp', { withTimezone: true }).notNull(),
  type:            eventTypeEnum('type').notNull(),
  label:           text('label'),
  detail:          text('detail'),           // System detail notes, question text, etc.
  suggestionUsed:  boolean('suggestion_used').default(false).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// TABLE 9: artifacts
export const artifacts = pgTable('artifacts', {
  id:                uuid('id').defaultRandom().primaryKey(),
  processId:         uuid('process_id').notNull().references(() => processes.id),
  sessionId:         uuid('session_id').references(() => sessions.id),
  filename:          text('filename').notNull(),
  storagePath:       text('storage_path').notNull(),
  fileSizeBytes:     integer('file_size_bytes').notNull(),
  mimeType:          text('mime_type').notNull(),
  sourceDescription: text('source_description'),
  label:             text('label'),
  stage:             artifactStageEnum('stage'),
  confirmed:         boolean('confirmed').default(false).notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:         timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 10: open_questions
export const openQuestions = pgTable('open_questions', {
  id:              uuid('id').defaultRandom().primaryKey(),
  processId:       uuid('process_id').notNull().references(() => processes.id),
  sessionId:       uuid('session_id').references(() => sessions.id),
  text:            text('text').notNull(),
  priority:        questionPriorityEnum('priority').notNull(),
  status:          questionStatusEnum('status').default('open').notNull(),
  resolvedAt:      timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
});

// TABLE 11: research_notes
export const researchNotes = pgTable('research_notes', {
  id:          uuid('id').defaultRandom().primaryKey(),
  clientId:    uuid('client_id').references(() => clients.id),
  processId:   uuid('process_id').references(() => processes.id),
  query:       text('query').notNull(),
  response:    text('response').notNull(),
  sources:     jsonb('sources').default([]).notNull(),  // ResearchSource[]
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ====================================================================
// RELATIONS — for Drizzle relational queries (db.query.*)
// ====================================================================

export const clientsRelations = relations(clients, ({ many }) => ({
  contacts:      many(contacts),
  processes:     many(processes),
  researchNotes: many(researchNotes),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  client:          one(clients, { fields: [contacts.clientId], references: [clients.id] }),
  sessionContacts: many(sessionContacts),
}));

export const processesRelations = relations(processes, ({ one, many }) => ({
  client:        one(clients, { fields: [processes.clientId], references: [clients.id] }),
  processModel:  one(processModels),
  sessions:      many(sessions),
  artifacts:     many(artifacts),
  openQuestions:  many(openQuestions),
  researchNotes: many(researchNotes),
}));

export const processModelsRelations = relations(processModels, ({ one, many }) => ({
  process:   one(processes, { fields: [processModels.processId], references: [processes.id] }),
  snapshots: many(processModelSnapshots),
}));

export const processModelSnapshotsRelations = relations(processModelSnapshots, ({ one }) => ({
  processModel: one(processModels, { fields: [processModelSnapshots.processModelId], references: [processModels.id] }),
  session:      one(sessions, { fields: [processModelSnapshots.sessionId], references: [sessions.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  process:         one(processes, { fields: [sessions.processId], references: [processes.id] }),
  sessionContacts: many(sessionContacts),
  eventLogs:       many(eventLogs),
  artifacts:       many(artifacts),
  openQuestions:    many(openQuestions),
}));

export const sessionContactsRelations = relations(sessionContacts, ({ one }) => ({
  session: one(sessions, { fields: [sessionContacts.sessionId], references: [sessions.id] }),
  contact: one(contacts, { fields: [sessionContacts.contactId], references: [contacts.id] }),
}));

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  session: one(sessions, { fields: [eventLogs.sessionId], references: [sessions.id] }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  process: one(processes, { fields: [artifacts.processId], references: [processes.id] }),
  session: one(sessions, { fields: [artifacts.sessionId], references: [sessions.id] }),
}));

export const openQuestionsRelations = relations(openQuestions, ({ one }) => ({
  process: one(processes, { fields: [openQuestions.processId], references: [processes.id] }),
  session: one(sessions, { fields: [openQuestions.sessionId], references: [sessions.id] }),
}));

export const researchNotesRelations = relations(researchNotes, ({ one }) => ({
  client:  one(clients, { fields: [researchNotes.clientId], references: [clients.id] }),
  process: one(processes, { fields: [researchNotes.processId], references: [processes.id] }),
}));

// ====================================================================
// ZOD SCHEMAS — for request validation
// ====================================================================

export const insertClientSchema = createInsertSchema(clients);
export const selectClientSchema = createSelectSchema(clients);

export const insertContactSchema = createInsertSchema(contacts);
export const selectContactSchema = createSelectSchema(contacts);

export const insertProcessSchema = createInsertSchema(processes);
export const selectProcessSchema = createSelectSchema(processes);

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export const insertEventLogSchema = createInsertSchema(eventLogs);

export const insertArtifactSchema = createInsertSchema(artifacts);

export const insertOpenQuestionSchema = createInsertSchema(openQuestions);

export const insertResearchNoteSchema = createInsertSchema(researchNotes);

// ====================================================================
// TYPESCRIPT TYPES — inferred from Drizzle schema
// ====================================================================

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

export type Process = typeof processes.$inferSelect;
export type NewProcess = typeof processes.$inferInsert;

export type ProcessModel = typeof processModels.$inferSelect;
export type NewProcessModel = typeof processModels.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type SessionContact = typeof sessionContacts.$inferSelect;
export type NewSessionContact = typeof sessionContacts.$inferInsert;

export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type OpenQuestion = typeof openQuestions.$inferSelect;
export type NewOpenQuestion = typeof openQuestions.$inferInsert;

export type ResearchNote = typeof researchNotes.$inferSelect;
export type NewResearchNote = typeof researchNotes.$inferInsert;

export type ProcessModelSnapshot = typeof processModelSnapshots.$inferSelect;
export type NewProcessModelSnapshot = typeof processModelSnapshots.$inferInsert;
```

**Run: `npm run test` → should now PASS.**

---

## Step 1.3 — JSONB Type Definitions

Create `src/lib/db/types.ts`. These are the TypeScript interfaces for the JSONB columns. They are NOT stored in the DB — they describe the shape of the JSON inside JSONB fields.

```typescript
// ====================================================================
// ProcessModel JSONB types (stored in processModels.steps/edgeCases/systems)
// ====================================================================

export interface ProcessStep {
  id: string;                      // e.g. "step_001"
  order: number;                   // 1, 2, 3...
  name: string;                    // "Open supplier email" (3-8 words)
  description: string;             // One sentence
  confidence: 'confirmed' | 'inferred' | 'missing';
  sourceSessionId?: string;        // Which session confirmed/created this
  systems: string[];               // ["Email", "Excel"]
  nextSteps: string[];             // ["step_002"] — multiple = branch
  branchCondition?: string | null; // "Price present?" — only if nextSteps.length > 1
  relatedEdgeCases: string[];      // ["edge_001"]
  notes: string;                   // Free text
}

export interface EdgeCase {
  id: string;                      // e.g. "edge_001"
  description: string;             // "Supplier responds without price"
  frequency: 'rare' | 'occasional' | 'frequent' | 'unknown';
  suggestedHandling: string;       // "Flag for manual review"
  status: 'open' | 'needs_clarification' | 'resolved';
  sourceSessionId?: string;
  relatedStepId?: string;          // Which step this edge case applies to
}

export interface SystemEntry {
  name: string;                    // "Excel", "SharePoint", "SAP"
  confirmed: boolean;              // true if directly observed
  role: string;                    // "Document storage for proformas"
  details: string;                 // "/Proformas/Pending folder"
  gaps: string;                    // "Unknown: who has write access?"
  detailNotes: string;             // FREE TEXT for column mappings, sheet names, etc.
                                    // e.g. "Sheet: Quotes2024\nCol A = Supplier Name\n
                                    //       Col B = Unit Price (EUR)\nCol C = Currency\n
                                    //       Data mapped from supplier email body"
                                    // Phase 2 will add structured schema metadata
  sourceSessionId?: string;
}

// ====================================================================
// Session JSONB types
// ====================================================================

export interface InterviewAnswers {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export interface PrepBrief {
  whatWeKnow: string;              // Markdown
  whatsOpen: string;               // Markdown
  suggestedFocus: string[];        // 5-10 actionable items
}

export interface ShadowingConfig {
  personShadowedContactId: string;
  focusArea: 'full_flow' | 'specific_steps' | 'edge_cases_only';
  gapsToFill: string[];            // Open question IDs to focus on
}

export interface ValidationConfig {
  stepsToValidate: string[];       // ProcessStep IDs
}

export interface DemoConfig {
  scenarios: string;               // Free text
  knownEdgeCases: string;          // Free text
}

export interface DebriefItem {
  eventLogId: string;
  type: 'question' | 'implicit';
  resolution: 'asked_answered' | 'described' | 'open_question' | 'skipped';
  answer?: string;                 // For asked_answered
  description?: string;            // For described (implicit)
  priority?: 'critical' | 'important' | 'nice_to_have';  // For open_question
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

## Step 1.4 — Generate & Apply Migrations

```bash
# Generate SQL migration files from schema
npm run db:generate

# Push directly to Supabase (development)
npm run db:push

# Verify with Drizzle Studio
npm run db:studio
```

Open Drizzle Studio and confirm all 11 tables exist with correct columns.

---

## Step 1.5 — Query Layer

Create one query file per entity. Each file exports: `create`, `list` (with filters), `getById`, `update`, `softDelete` (where applicable).

### `src/lib/db/queries/clients.ts`

```typescript
import { eq, and, isNull, ilike, inArray, desc } from 'drizzle-orm';
import { db } from '../index';
import { clients, contacts, processes, type NewClient } from '../schema';

const notDeleted = isNull(clients.deletedAt);

export async function createClient(data: NewClient) {
  const [client] = await db.insert(clients).values(data).returning();
  return client;
}

export async function listClients(filters?: {
  search?: string;
  status?: string[];
  industry?: string[];
}) {
  const conditions = [notDeleted];
  if (filters?.search) conditions.push(ilike(clients.name, `%${filters.search}%`));
  if (filters?.status?.length) conditions.push(inArray(clients.status, filters.status as any));
  if (filters?.industry?.length) conditions.push(inArray(clients.industry, filters.industry));

  return db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.updatedAt));
}

export async function getClientById(id: string) {
  const [client] = await db.select().from(clients).where(and(eq(clients.id, id), notDeleted));
  return client ?? null;
}

export async function getClientWithRelations(id: string) {
  const client = await getClientById(id);
  if (!client) return null;
  const clientContacts = await db.select().from(contacts)
    .where(and(eq(contacts.clientId, id), isNull(contacts.deletedAt)));
  const clientProcesses = await db.select().from(processes)
    .where(and(eq(processes.clientId, id), isNull(processes.deletedAt)));
  return { ...client, contacts: clientContacts, processes: clientProcesses };
}

export async function updateClient(id: string, data: Partial<NewClient>) {
  const [updated] = await db.update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function softDeleteClient(id: string) {
  const now = new Date();
  await db.update(contacts).set({ deletedAt: now }).where(eq(contacts.clientId, id));
  await db.update(processes).set({ deletedAt: now }).where(eq(processes.clientId, id));
  const [deleted] = await db.update(clients).set({ deletedAt: now, updatedAt: now })
    .where(eq(clients.id, id)).returning();
  return deleted ?? null;
}
```

### `src/lib/db/queries/contacts.ts`

```typescript
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../index';
import { contacts, type NewContact } from '../schema';

const notDeleted = isNull(contacts.deletedAt);

export async function createContact(data: NewContact) {
  const [contact] = await db.insert(contacts).values(data).returning();
  return contact;
}

export async function listContactsByClient(clientId: string) {
  return db.select().from(contacts)
    .where(and(eq(contacts.clientId, clientId), notDeleted));
}

export async function getContactById(id: string) {
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), notDeleted));
  return contact ?? null;
}

export async function updateContact(id: string, data: Partial<NewContact>) {
  const [updated] = await db.update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function softDeleteContact(id: string) {
  const [deleted] = await db.update(contacts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(contacts.id, id)).returning();
  return deleted ?? null;
}
```

### `src/lib/db/queries/processes.ts`

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { processes, processModels, sessions, openQuestions, type NewProcess } from '../schema';

const notDeleted = isNull(processes.deletedAt);

export async function createProcess(data: NewProcess) {
  const [process] = await db.insert(processes).values(data).returning();
  return process;
}

export async function createProcessModel(processId: string) {
  const [model] = await db.insert(processModels).values({
    processId,
    steps: [],
    edgeCases: [],
    systems: [],
  }).returning();
  return model;
}

export async function listProcessesByClient(clientId: string) {
  return db.select().from(processes)
    .where(and(eq(processes.clientId, clientId), notDeleted))
    .orderBy(desc(processes.updatedAt));
}

export async function getProcessById(id: string) {
  const [process] = await db.select().from(processes).where(and(eq(processes.id, id), notDeleted));
  return process ?? null;
}

export async function getProcessWithModel(id: string) {
  const process = await getProcessById(id);
  if (!process) return null;
  const [model] = await db.select().from(processModels).where(eq(processModels.processId, id));
  const questions = await db.select().from(openQuestions)
    .where(and(eq(openQuestions.processId, id), isNull(openQuestions.deletedAt)));
  return { ...process, processModel: model ?? null, openQuestions: questions };
}

export async function getProcessWithFullContext(id: string) {
  const process = await getProcessWithModel(id);
  if (!process) return null;
  const processSessions = await db.select().from(sessions)
    .where(and(eq(sessions.processId, id), isNull(sessions.deletedAt)))
    .orderBy(desc(sessions.createdAt));
  return { ...process, sessions: processSessions };
}

export async function updateProcess(id: string, data: Partial<NewProcess>) {
  const [updated] = await db.update(processes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(processes.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function getProcessModel(processId: string) {
  const [model] = await db.select().from(processModels).where(eq(processModels.processId, processId));
  return model ?? null;
}

export async function updateProcessModel(processId: string, data: { steps?: any; edgeCases?: any; systems?: any }) {
  const [updated] = await db.update(processModels)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(processModels.processId, processId))
    .returning();
  return updated ?? null;
}

export async function createSnapshot(data: { processModelId: string; trigger: 'synthesis_apply' | 'validation_merge'; sessionId?: string; state: any }) {
  const [snapshot] = await db.insert(processModelSnapshots).values(data).returning();
  return snapshot;
}
```

### `src/lib/db/queries/sessions.ts`

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { sessions, sessionContacts, eventLogs, type NewSession } from '../schema';

const notDeleted = isNull(sessions.deletedAt);

export async function createSession(data: NewSession) {
  const [session] = await db.insert(sessions).values(data).returning();
  return session;
}

export async function createSessionContacts(
  sessionId: string,
  contactIds: string[],
  roles: Record<string, string>
) {
  const values = contactIds.map((contactId) => ({
    sessionId,
    contactId,
    roleInSession: roles[contactId] ?? null,
  }));
  await db.insert(sessionContacts).values(values);
}

export async function listSessionsByProcess(processId: string) {
  return db.select().from(sessions)
    .where(and(eq(sessions.processId, processId), notDeleted))
    .orderBy(desc(sessions.date));
}

export async function getSessionById(id: string) {
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, id), notDeleted));
  return session ?? null;
}

export async function getSessionWithFullContext(id: string) {
  const session = await getSessionById(id);
  if (!session) return null;

  const events = await db.select().from(eventLogs)
    .where(eq(eventLogs.sessionId, id))
    .orderBy(eventLogs.timestamp);

  const process = await getProcessWithFullContext(session.processId);

  return { ...session, eventLogs: events, process };
}

export async function updateSession(id: string, data: Partial<NewSession>) {
  const [updated] = await db.update(sessions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sessions.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

// Import needed for getProcessWithFullContext
import { getProcessWithFullContext } from './processes';
```

### `src/lib/db/queries/events.ts`

```typescript
import { eq, and, isNull, or } from 'drizzle-orm';
import { db } from '../index';
import { eventLogs, type NewEventLog } from '../schema';

export async function createEvent(data: NewEventLog) {
  const [event] = await db.insert(eventLogs).values(data).returning();
  return event;
}

export async function getEventsBySessionId(sessionId: string) {
  return db.select().from(eventLogs)
    .where(eq(eventLogs.sessionId, sessionId))
    .orderBy(eventLogs.timestamp);
}

export async function getEventById(id: string) {
  const [event] = await db.select().from(eventLogs).where(eq(eventLogs.id, id));
  return event ?? null;
}

export async function getDebriefEvents(sessionId: string) {
  return db.select().from(eventLogs)
    .where(and(
      eq(eventLogs.sessionId, sessionId),
      or(
        eq(eventLogs.type, 'QUESTION'),
        and(eq(eventLogs.type, 'IMPLICIT'), isNull(eventLogs.label))
      )
    ))
    .orderBy(eventLogs.timestamp);
}

export async function updateEventLabel(id: string, label: string) {
  const [updated] = await db.update(eventLogs).set({ label }).where(eq(eventLogs.id, id)).returning();
  return updated ?? null;
}

export async function updateEventDetail(id: string, detail: string) {
  const [updated] = await db.update(eventLogs).set({ detail }).where(eq(eventLogs.id, id)).returning();
  return updated ?? null;
}
```

### `src/lib/db/queries/questions.ts`

```typescript
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import { db } from '../index';
import { openQuestions, type NewOpenQuestion } from '../schema';

const notDeleted = isNull(openQuestions.deletedAt);

export async function createOpenQuestion(data: NewOpenQuestion) {
  const [question] = await db.insert(openQuestions).values(data).returning();
  return question;
}

export async function listQuestionsByProcess(processId: string) {
  return db.select().from(openQuestions)
    .where(and(eq(openQuestions.processId, processId), notDeleted))
    .orderBy(desc(openQuestions.createdAt));
}

export async function getOpenQuestionsByIds(ids: string[]) {
  return db.select().from(openQuestions)
    .where(and(inArray(openQuestions.id, ids), notDeleted));
}

export async function updateOpenQuestion(id: string, data: Partial<NewOpenQuestion>) {
  const [updated] = await db.update(openQuestions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(openQuestions.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function resolveQuestion(id: string, resolutionNotes: string) {
  return updateOpenQuestion(id, {
    status: 'resolved',
    resolvedAt: new Date(),
    resolutionNotes,
  });
}
```

### `src/lib/db/queries/artifacts.ts`

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../index';
import { artifacts, type NewArtifact } from '../schema';

const notDeleted = isNull(artifacts.deletedAt);

export async function createArtifact(data: NewArtifact) {
  const [artifact] = await db.insert(artifacts).values(data).returning();
  return artifact;
}

export async function listArtifactsByProcess(processId: string) {
  return db.select().from(artifacts)
    .where(and(eq(artifacts.processId, processId), notDeleted))
    .orderBy(desc(artifacts.createdAt));
}

export async function updateArtifact(id: string, data: Partial<NewArtifact>) {
  const [updated] = await db.update(artifacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(artifacts.id, id), notDeleted))
    .returning();
  return updated ?? null;
}

export async function softDeleteArtifact(id: string) {
  const [deleted] = await db.update(artifacts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(artifacts.id, id)).returning();
  return deleted ?? null;
}
```

### `src/lib/db/queries/research-notes.ts`

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../index';
import { researchNotes, type NewResearchNote } from '../schema';

export async function createResearchNote(data: NewResearchNote) {
  const [note] = await db.insert(researchNotes).values(data).returning();
  return note;
}

export async function listResearchNotesByClient(clientId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.clientId, clientId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}

export async function listResearchNotesByProcess(processId: string, limit = 10) {
  return db.select().from(researchNotes)
    .where(eq(researchNotes.processId, processId))
    .orderBy(desc(researchNotes.createdAt))
    .limit(limit);
}
```

---

## Step 1.6 — Seed Script

Create `src/lib/db/seed.ts`:

```typescript
import 'dotenv/config';
import { db } from './index';
import { clients, contacts, processes, processModels, openQuestions } from './schema';

async function seed() {
  console.log('🌱 Seeding database...');

  // Client 1: Omatapalo (active POC)
  const [client1] = await db.insert(clients).values({
    name: 'Omatapalo',
    industry: 'Construction',
    website: 'https://omatapalo.com',
    hqLocation: 'Madrid, Spain',
    status: 'active_poc',
    notes: 'Venture Vanguard arm. Procurement department.',
    aiSummary: 'Omatapalo is a Spanish construction company with a procurement department that handles supplier quote intake, RFQ generation, and purchase order creation.',
  }).returning();
  console.log(`  Created client: ${client1.name}`);

  // Client 1 contacts
  await db.insert(contacts).values([
    { clientId: client1.id, name: 'Jorge García', role: 'Procurement Director', department: 'Procurement', email: 'jorge@omatapalo.com' },
    { clientId: client1.id, name: 'María López', role: 'Senior Buyer', department: 'Procurement', email: 'maria@omatapalo.com' },
    { clientId: client1.id, name: 'Carlos Ruiz', role: 'Junior Buyer', department: 'Procurement' },
  ]);
  console.log('  Created 3 contacts');

  // Client 1 process
  const [proc1] = await db.insert(processes).values({
    clientId: client1.id,
    name: 'Supplier Quote Intake',
    departmentTag: 'Procurement',
    description: 'Team receives supplier quotes via email, compares prices in Excel, generates PO.',
    status: 'mapping',
    processTypeL1: 'procurement',
    hypothesisText: 'The procurement team receives supplier quotes via email (Outlook). María and Carlos manually copy quote data into an Excel comparison spreadsheet. Once a supplier is selected, Jorge approves and a PO is generated in their ERP system.',
  }).returning();

  await db.insert(processModels).values({
    processId: proc1.id,
    steps: [
      { id: 'step_001', order: 1, name: 'Receive supplier email', description: 'Quote arrives via Outlook', confidence: 'confirmed', systems: ['Email'], nextSteps: ['step_002'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_002', order: 2, name: 'Open and review quote', description: 'Buyer opens email, checks attachments', confidence: 'confirmed', systems: ['Email'], nextSteps: ['step_003'], branchCondition: null, relatedEdgeCases: ['edge_001'], notes: '' },
      { id: 'step_003', order: 3, name: 'Enter data in comparison map', description: 'Copy price, terms, delivery into Excel', confidence: 'inferred', systems: ['Excel'], nextSteps: ['step_004'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_004', order: 4, name: 'Compare suppliers', description: 'Review comparison and select best option', confidence: 'inferred', systems: ['Excel'], nextSteps: ['step_005'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_005', order: 5, name: 'Request approval', description: 'Send selection to director for approval', confidence: 'inferred', systems: ['Email'], nextSteps: ['step_006'], branchCondition: null, relatedEdgeCases: [], notes: '' },
      { id: 'step_006', order: 6, name: 'Generate purchase order', description: 'Create PO in ERP system', confidence: 'missing', systems: ['ERP'], nextSteps: [], branchCondition: null, relatedEdgeCases: [], notes: '' },
    ],
    edgeCases: [
      { id: 'edge_001', description: 'Supplier responds without price in email body (price only in attachment)', frequency: 'occasional', suggestedHandling: 'Open attachment to extract price', status: 'open', relatedStepId: 'step_002' },
    ],
    systems: [
      { name: 'Email', confirmed: true, role: 'Receive supplier quotes', details: 'Outlook', gaps: '', detailNotes: '', sourceSessionId: undefined },
      { name: 'Excel', confirmed: false, role: 'Price comparison', details: '', gaps: 'Which file? Which sheet? Column structure?', detailNotes: '', sourceSessionId: undefined },
      { name: 'ERP', confirmed: false, role: 'PO generation', details: '', gaps: 'Which ERP system? SAP? Custom?', detailNotes: '', sourceSessionId: undefined },
    ],
  });
  console.log(`  Created process: ${proc1.name} with 6 steps`);

  await db.insert(openQuestions).values([
    { processId: proc1.id, text: 'What triggers the PO generation — is it automatic after approval?', priority: 'critical', status: 'open' },
    { processId: proc1.id, text: 'Does the manager approve every PO or only above a threshold?', priority: 'critical', status: 'open' },
    { processId: proc1.id, text: 'What naming convention does the comparison Excel use?', priority: 'important', status: 'open' },
  ]);
  console.log('  Created 3 open questions');

  // Client 2: Empty prospecting client
  await db.insert(clients).values({
    name: 'Logistika Express',
    industry: 'Logistics',
    status: 'prospecting',
    notes: 'First contact at trade show. Interested in freight forwarding automation.',
  });
  console.log('  Created client: Logistika Express (empty)');

  console.log('\n✅ Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

Run: `npm run db:seed`

---

## Phase 1 Gate Checklist

- [ ] Schema test passes: `npm run test`
- [ ] All 11 tables exist in Supabase: verify with `npm run db:studio`
- [ ] `clients` table: id, name, industry, website, hq_location, notes, status, ai_summary, created_at, updated_at, deleted_at
- [ ] `contacts` table: id, client_id (FK), name, role, department, email, phone, notes, created_at, updated_at, deleted_at
- [ ] `processes` table: id, client_id (FK), name, department_tag, description, status, hypothesis_text, process_type_l1, created_at, updated_at, deleted_at
- [ ] `process_models` table: id, process_id (FK, unique), steps (JSONB), edge_cases (JSONB), systems (JSONB), created_at, updated_at
- [ ] `process_model_snapshots` table: id, process_model_id (FK), trigger, session_id (FK nullable), state (JSONB), created_at
- [ ] `sessions` table: id, process_id (FK), type, date, status, interview_answers, prep_brief, **transcript_text**, **notes**, ai_summary, synthesis_output, debrief_answers, shadowing_config, validation_config, demo_config, created_at, updated_at, deleted_at
- [ ] `session_contacts` table: id, session_id (FK), contact_id (FK), role_in_session
- [ ] `event_logs` table: id, session_id (FK), timestamp, type, label, detail, suggestion_used, created_at
- [ ] `artifacts` table: id, process_id (FK), session_id (FK nullable), filename, storage_path, file_size_bytes, mime_type, source_description, label, stage, confirmed, created_at, updated_at, deleted_at
- [ ] `open_questions` table: id, process_id (FK), session_id (FK nullable), text, priority, status, resolved_at, resolution_notes, created_at, updated_at, deleted_at
- [ ] `research_notes` table: id, client_id (FK nullable), process_id (FK nullable), query, response, sources (JSONB), created_at
- [ ] All 9 enum types created in PostgreSQL
- [ ] JSONB types defined in `src/lib/db/types.ts` including `SystemEntry.detailNotes`
- [ ] Query files created for all 8 entities with CRUD operations
- [ ] Seed script runs: `npm run db:seed` populates 2 clients, contacts, 1 process with model
- [ ] Drizzle Studio shows seeded data
