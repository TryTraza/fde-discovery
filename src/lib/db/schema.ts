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
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

// ====================================================================
// ENUMS — 9 total
// ====================================================================

export const clientStatusEnum = pgEnum('client_status', [
  'prospecting',
  'active_poc',
  'demo_ready',
  'closed',
])

export const processStatusEnum = pgEnum('process_status', [
  'draft',
  'mapping',
  'validated',
  'locked',
])

export const sessionTypeEnum = pgEnum('session_type', [
  'discovery',
  'process_mapping',
  'shadowing',
  'validation',
  'demo',
])

export const sessionStatusEnum = pgEnum('session_status', [
  'planned',
  'in_progress',
  'completed',
  'synthesis_done',
])

export const eventTypeEnum = pgEnum('event_type', [
  'STEP',
  'EDGE',
  'SYSTEM',
  'IMPLICIT',
  'QUESTION',
])

export const artifactStageEnum = pgEnum('artifact_stage', [
  'input',
  'intermediate',
  'output',
  'reference',
])

export const questionPriorityEnum = pgEnum('question_priority', [
  'critical',
  'important',
  'nice_to_have',
])

export const questionStatusEnum = pgEnum('question_status', ['open', 'sent', 'resolved'])

export const snapshotTriggerEnum = pgEnum('snapshot_trigger', [
  'synthesis_apply',
  'validation_merge',
])

export const aiModeEnum = pgEnum('ai_mode', ['generateObject', 'generateText', 'streamText'])

export const modelTierEnum = pgEnum('model_tier', ['fast', 'standard'])

export const skillTypeEnum = pgEnum('skill_type', [
  'system-prompt',
  'context-enrichment',
  'instruction',
])

// ====================================================================
// ENUM CONSTANTS + UNION TYPES — derived from pgEnum definitions
// ====================================================================

export const CLIENT_STATUSES = clientStatusEnum.enumValues
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const PROCESS_STATUSES = processStatusEnum.enumValues
export type ProcessStatus = (typeof PROCESS_STATUSES)[number]

export const SESSION_TYPES = sessionTypeEnum.enumValues
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_STATUSES = sessionStatusEnum.enumValues
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const EVENT_TYPES = eventTypeEnum.enumValues
export type EventType = (typeof EVENT_TYPES)[number]
// Mutable copy for z.enum() which rejects readonly tuples at the type level.
export const EVENT_TYPES_MUTABLE = [...EVENT_TYPES] as [string, ...string[]]

export const ARTIFACT_STAGES = artifactStageEnum.enumValues
export type ArtifactStage = (typeof ARTIFACT_STAGES)[number]

export const QUESTION_PRIORITIES = questionPriorityEnum.enumValues
export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number]

export const QUESTION_STATUSES = questionStatusEnum.enumValues
export type QuestionStatus = (typeof QUESTION_STATUSES)[number]

export const SNAPSHOT_TRIGGERS = snapshotTriggerEnum.enumValues
export type SnapshotTrigger = (typeof SNAPSHOT_TRIGGERS)[number]

// ====================================================================
// TABLES — 11 total
// ====================================================================

// TABLE 1: clients
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  website: text('website'),
  hqLocation: text('hq_location'),
  notes: text('notes'),
  status: clientStatusEnum('status').default('prospecting').notNull(),
  aiSummary: text('ai_summary'),
  profile: jsonb('profile'), // CompanyProfile — see src/lib/ai/contracts/company-profile
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// TABLE 2: contacts
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  role: text('role'),
  department: text('department'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// TABLE 3: processes
export const processes = pgTable('processes', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  departmentTag: text('department_tag'),
  description: text('description'),
  status: processStatusEnum('status').default('draft').notNull(),
  hypothesisText: text('hypothesis_text'),
  processTypeL1: text('process_type_l1').default('unknown'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// TABLE 4: process_models (one-to-one with processes)
export const processModels = pgTable('process_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id')
    .notNull()
    .references(() => processes.id)
    .unique(),
  steps: jsonb('steps').default([]).notNull(), // ProcessStep[]
  edgeCases: jsonb('edge_cases').default([]).notNull(), // EdgeCase[]
  systems: jsonb('systems').default([]).notNull(), // SystemEntry[]
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// TABLE 5: process_model_snapshots (internal backups, no UI)
export const processModelSnapshots = pgTable('process_model_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  processModelId: uuid('process_model_id')
    .notNull()
    .references(() => processModels.id),
  trigger: snapshotTriggerEnum('trigger').notNull(),
  sessionId: uuid('session_id').references(() => sessions.id),
  state: jsonb('state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// TABLE 6: sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id')
    .notNull()
    .references(() => processes.id),
  type: sessionTypeEnum('type').notNull(),
  title: text('title').notNull(),
  date: date('date').notNull(),
  status: sessionStatusEnum('status').default('planned').notNull(),
  durationMinutes: integer('duration_minutes'),
  createdBy: text('created_by'),
  interviewAnswers: jsonb('interview_answers'), // InterviewAnswers
  prepBrief: jsonb('prep_brief'), // PrepBrief
  questionsAsked: jsonb('questions_asked'), // boolean[]
  transcriptText: text('transcript_text'), // Pasted from Granola or recording tool
  notes: text('notes'), // User's own notes/observations
  aiSummary: text('ai_summary'),
  synthesisOutput: jsonb('synthesis_output'),
  debriefAnswers: jsonb('debrief_answers'), // DebriefAnswers
  shadowingConfig: jsonb('shadowing_config'), // ShadowingConfig
  validationConfig: jsonb('validation_config'), // ValidationConfig
  demoConfig: jsonb('demo_config'), // DemoConfig
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// TABLE 7: session_contacts (many-to-many join)
export const sessionContacts = pgTable('session_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id),
  roleInSession: text('role_in_session'),
})

// TABLE 8: event_logs (shadowing capture events)
export const eventLogs = pgTable('event_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  type: eventTypeEnum('type').notNull(),
  label: text('label'),
  detail: text('detail'), // System detail notes, question text, etc.
  suggestionUsed: boolean('suggestion_used').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// TABLE 9: artifacts
export const artifacts = pgTable('artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id')
    .notNull()
    .references(() => processes.id),
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
})

// TABLE 10: open_questions
export const openQuestions = pgTable('open_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  processId: uuid('process_id')
    .notNull()
    .references(() => processes.id),
  sessionId: uuid('session_id').references(() => sessions.id),
  text: text('text').notNull(),
  priority: questionPriorityEnum('priority').notNull(),
  status: questionStatusEnum('status').default('open').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// TABLE 11: research_notes
export const researchNotes = pgTable('research_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id),
  processId: uuid('process_id').references(() => processes.id),
  query: text('query').notNull(),
  response: text('response').notNull(),
  sources: jsonb('sources').default([]).notNull(), // ResearchSource[]
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ====================================================================
// RELATIONS — for Drizzle relational queries (db.query.*)
// ====================================================================

export const clientsRelations = relations(clients, ({ many }) => ({
  contacts: many(contacts),
  processes: many(processes),
  researchNotes: many(researchNotes),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  client: one(clients, { fields: [contacts.clientId], references: [clients.id] }),
  sessionContacts: many(sessionContacts),
}))

export const processesRelations = relations(processes, ({ one, many }) => ({
  client: one(clients, { fields: [processes.clientId], references: [clients.id] }),
  processModel: one(processModels),
  sessions: many(sessions),
  artifacts: many(artifacts),
  openQuestions: many(openQuestions),
  researchNotes: many(researchNotes),
}))

export const processModelsRelations = relations(processModels, ({ one, many }) => ({
  process: one(processes, { fields: [processModels.processId], references: [processes.id] }),
  snapshots: many(processModelSnapshots),
}))

export const processModelSnapshotsRelations = relations(processModelSnapshots, ({ one }) => ({
  processModel: one(processModels, {
    fields: [processModelSnapshots.processModelId],
    references: [processModels.id],
  }),
  session: one(sessions, { fields: [processModelSnapshots.sessionId], references: [sessions.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  process: one(processes, { fields: [sessions.processId], references: [processes.id] }),
  sessionContacts: many(sessionContacts),
  eventLogs: many(eventLogs),
  artifacts: many(artifacts),
  openQuestions: many(openQuestions),
}))

export const sessionContactsRelations = relations(sessionContacts, ({ one }) => ({
  session: one(sessions, { fields: [sessionContacts.sessionId], references: [sessions.id] }),
  contact: one(contacts, { fields: [sessionContacts.contactId], references: [contacts.id] }),
}))

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  session: one(sessions, { fields: [eventLogs.sessionId], references: [sessions.id] }),
}))

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  process: one(processes, { fields: [artifacts.processId], references: [processes.id] }),
  session: one(sessions, { fields: [artifacts.sessionId], references: [sessions.id] }),
}))

export const openQuestionsRelations = relations(openQuestions, ({ one }) => ({
  process: one(processes, { fields: [openQuestions.processId], references: [processes.id] }),
  session: one(sessions, { fields: [openQuestions.sessionId], references: [sessions.id] }),
}))

export const researchNotesRelations = relations(researchNotes, ({ one }) => ({
  client: one(clients, { fields: [researchNotes.clientId], references: [clients.id] }),
  process: one(processes, { fields: [researchNotes.processId], references: [processes.id] }),
}))

// ====================================================================
// ZOD SCHEMAS — for request validation
// ====================================================================

export const insertClientSchema = createInsertSchema(clients)
export const selectClientSchema = createSelectSchema(clients)

export const insertContactSchema = createInsertSchema(contacts)
export const selectContactSchema = createSelectSchema(contacts)

export const insertProcessSchema = createInsertSchema(processes)
export const selectProcessSchema = createSelectSchema(processes)

export const insertSessionSchema = createInsertSchema(sessions)
export const selectSessionSchema = createSelectSchema(sessions)

export const insertEventLogSchema = createInsertSchema(eventLogs)

export const insertArtifactSchema = createInsertSchema(artifacts)

export const insertOpenQuestionSchema = createInsertSchema(openQuestions)

export const insertResearchNoteSchema = createInsertSchema(researchNotes)

// ====================================================================
// AI AGENTS + SKILLS TABLES
// ====================================================================

export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  mode: aiModeEnum('mode').notNull(),
  model: modelTierEnum('model').notNull(),
  layers: jsonb('layers').notNull().default([]),
  langfusePromptName: text('langfuse_prompt_name').notNull(),
  schemaSlug: text('schema_slug'),
  tools: jsonb('tools').notNull().default([]),
  maxOutputTokens: integer('max_output_tokens').notNull().default(1000),
  skills: jsonb('skills').notNull().default([]),
  resilience: jsonb('resilience').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  type: skillTypeEnum('type').notNull(),
  content: text('content').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const insertAiAgentSchema = createInsertSchema(aiAgents)
export const insertSkillSchema = createInsertSchema(skills)

// ====================================================================
// TYPESCRIPT TYPES — inferred from Drizzle schema
// ====================================================================

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert

export type Process = typeof processes.$inferSelect
export type NewProcess = typeof processes.$inferInsert

export type ProcessModel = typeof processModels.$inferSelect
export type NewProcessModel = typeof processModels.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type SessionContact = typeof sessionContacts.$inferSelect
export type NewSessionContact = typeof sessionContacts.$inferInsert

export type EventLog = typeof eventLogs.$inferSelect
export type NewEventLog = typeof eventLogs.$inferInsert

export type Artifact = typeof artifacts.$inferSelect
export type NewArtifact = typeof artifacts.$inferInsert

export type OpenQuestion = typeof openQuestions.$inferSelect
export type NewOpenQuestion = typeof openQuestions.$inferInsert

export type ResearchNote = typeof researchNotes.$inferSelect
export type NewResearchNote = typeof researchNotes.$inferInsert

export type ProcessModelSnapshot = typeof processModelSnapshots.$inferSelect
export type NewProcessModelSnapshot = typeof processModelSnapshots.$inferInsert

export type AIAgent = typeof aiAgents.$inferSelect
export type NewAIAgent = typeof aiAgents.$inferInsert

export type SkillRow = typeof skills.$inferSelect
export type NewSkillRow = typeof skills.$inferInsert
