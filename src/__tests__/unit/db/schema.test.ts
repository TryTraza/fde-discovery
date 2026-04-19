import { describe, it, expect } from 'vitest'
import * as schema from '@/lib/db/schema'

describe('Database Schema — Tables', () => {
  it('exports all 13 tables', () => {
    const tables = [
      'clients',
      'contacts',
      'processes',
      'processModels',
      'processModelSnapshots',
      'sessions',
      'sessionContacts',
      'sessionProcessLinks',
      'eventLogs',
      'artifacts',
      'openQuestions',
      'researchNotes',
      'clientResearch',
    ]
    for (const t of tables) {
      expect((schema as any)[t]).toBeDefined()
    }
  })
})

describe('Database Schema — Enums', () => {
  it('exports all 9 enums', () => {
    const enums = [
      'clientStatusEnum',
      'processStatusEnum',
      'sessionTypeEnum',
      'sessionStatusEnum',
      'eventTypeEnum',
      'artifactStageEnum',
      'questionPriorityEnum',
      'questionStatusEnum',
      'snapshotTriggerEnum',
    ]
    for (const e of enums) {
      expect((schema as any)[e]).toBeDefined()
    }
  })
})

describe('Database Schema — Column Verification', () => {
  it('clients table has all columns', () => {
    const cols = Object.keys(schema.clients)
    const expected = [
      'id',
      'name',
      'industry',
      'website',
      'hqLocation',
      'notes',
      'status',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]
    for (const c of expected) expect(cols).toContain(c)
  })

  it('clients table no longer has aiSummary or profile columns', () => {
    const cols = Object.keys(schema.clients)
    expect(cols).not.toContain('aiSummary')
    expect(cols).not.toContain('profile')
  })

  it('contacts table has all columns', () => {
    const cols = Object.keys(schema.contacts)
    const expected = [
      'id',
      'clientId',
      'name',
      'role',
      'department',
      'email',
      'phone',
      'notes',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]
    for (const c of expected) expect(cols).toContain(c)
  })

  it('processes table has all columns', () => {
    const cols = Object.keys(schema.processes)
    const expected = [
      'id',
      'clientId',
      'name',
      'departmentTag',
      'description',
      'status',
      'hypothesisText',
      'processTypeL1',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]
    for (const c of expected) expect(cols).toContain(c)
  })

  it('processModels table has steps, edgeCases, systems as JSONB', () => {
    const cols = Object.keys(schema.processModels)
    expect(cols).toContain('processId')
    expect(cols).toContain('steps')
    expect(cols).toContain('edgeCases')
    expect(cols).toContain('systems')
  })

  it('sessions table has transcriptText AND notes', () => {
    const cols = Object.keys(schema.sessions)
    expect(cols).toContain('clientId')
    expect(cols).toContain('processId')
    expect(cols).toContain('transcriptText')
    expect(cols).toContain('notes')
  })

  it('sessions table has all JSONB config columns', () => {
    const cols = Object.keys(schema.sessions)
    const jsonbCols = [
      'interviewAnswers',
      'prepBrief',
      'synthesisOutput',
      'debriefAnswers',
      'shadowingConfig',
      'validationConfig',
      'demoConfig',
    ]
    for (const c of jsonbCols) expect(cols).toContain(c)
  })

  it('sessions table has questionsAsked column', () => {
    expect(schema.sessions.questionsAsked).toBeDefined()
  })

  it('eventLogs table has type, label, detail, suggestionUsed', () => {
    const cols = Object.keys(schema.eventLogs)
    for (const c of ['type', 'label', 'detail', 'suggestionUsed']) {
      expect(cols).toContain(c)
    }
  })

  it('artifacts table has all file-related columns', () => {
    const cols = Object.keys(schema.artifacts)
    for (const c of [
      'filename',
      'storagePath',
      'fileSizeBytes',
      'mimeType',
      'stage',
      'confirmed',
    ]) {
      expect(cols).toContain(c)
    }
  })

  it('openQuestions table has priority, status, resolvedAt', () => {
    const cols = Object.keys(schema.openQuestions)
    for (const c of ['priority', 'status', 'resolvedAt', 'resolutionNotes']) {
      expect(cols).toContain(c)
    }
  })
})

describe('Database Schema — Types', () => {
  it('exports insert and select Zod schemas for all main tables', () => {
    expect(schema.insertClientSchema).toBeDefined()
    expect(schema.selectClientSchema).toBeDefined()
    expect(schema.insertContactSchema).toBeDefined()
    expect(schema.selectContactSchema).toBeDefined()
    expect(schema.insertProcessSchema).toBeDefined()
    expect(schema.selectProcessSchema).toBeDefined()
    expect(schema.insertSessionSchema).toBeDefined()
    expect(schema.selectSessionSchema).toBeDefined()
    expect(schema.insertEventLogSchema).toBeDefined()
    expect(schema.insertArtifactSchema).toBeDefined()
    expect(schema.insertOpenQuestionSchema).toBeDefined()
    expect(schema.insertResearchNoteSchema).toBeDefined()
  })
})

// v4: FIX #32 — Enum value verification
describe('Enum values', () => {
  it('clientStatusEnum has correct values', () => {
    expect(schema.clientStatusEnum.enumValues).toEqual([
      'prospecting',
      'active_poc',
      'contracted',
      'expanding',
      'inactive',
    ])
  })

  it('processStatusEnum has correct values', () => {
    expect(schema.processStatusEnum.enumValues).toEqual(['draft', 'mapping', 'validated', 'locked'])
  })

  it('sessionTypeEnum has correct values', () => {
    expect(schema.sessionTypeEnum.enumValues).toEqual([
      'discovery',
      'process_mapping',
      'shadowing',
      'validation',
      'demo',
    ])
  })

  it('sessionStatusEnum has correct values', () => {
    expect(schema.sessionStatusEnum.enumValues).toEqual([
      'planned',
      'in_progress',
      'completed',
      'synthesis_done',
    ])
  })

  it('eventTypeEnum has correct values', () => {
    expect(schema.eventTypeEnum.enumValues).toEqual([
      'STEP',
      'EDGE',
      'SYSTEM',
      'IMPLICIT',
      'QUESTION',
    ])
  })

  it('artifactStageEnum has correct values', () => {
    expect(schema.artifactStageEnum.enumValues).toEqual([
      'input',
      'intermediate',
      'output',
      'reference',
    ])
  })

  it('questionPriorityEnum has correct values', () => {
    expect(schema.questionPriorityEnum.enumValues).toEqual([
      'critical',
      'important',
      'nice_to_have',
    ])
  })

  it('questionStatusEnum has correct values', () => {
    expect(schema.questionStatusEnum.enumValues).toEqual(['open', 'sent', 'resolved'])
  })

  it('snapshotTriggerEnum has correct values', () => {
    expect(schema.snapshotTriggerEnum.enumValues).toEqual(['synthesis_apply', 'validation_merge'])
  })
})
