import { describe, it, expect } from 'vitest';
import * as schema from '@/lib/db/schema';

describe('Schema enum constants', () => {
  it('exports CLIENT_STATUSES derived from clientStatusEnum', () => {
    expect(schema.CLIENT_STATUSES).toEqual(['prospecting', 'active_poc', 'demo_ready', 'closed']);
    // Must be the exact same reference as enumValues
    expect(schema.CLIENT_STATUSES).toBe(schema.clientStatusEnum.enumValues);
  });

  it('exports PROCESS_STATUSES derived from processStatusEnum', () => {
    expect(schema.PROCESS_STATUSES).toEqual(['draft', 'mapping', 'validated', 'locked']);
    expect(schema.PROCESS_STATUSES).toBe(schema.processStatusEnum.enumValues);
  });

  it('exports SESSION_TYPES derived from sessionTypeEnum', () => {
    expect(schema.SESSION_TYPES).toEqual(['discovery', 'process_mapping', 'shadowing', 'validation', 'demo']);
    expect(schema.SESSION_TYPES).toBe(schema.sessionTypeEnum.enumValues);
  });

  it('exports SESSION_STATUSES derived from sessionStatusEnum', () => {
    expect(schema.SESSION_STATUSES).toEqual(['planned', 'in_progress', 'completed', 'synthesis_done']);
    expect(schema.SESSION_STATUSES).toBe(schema.sessionStatusEnum.enumValues);
  });

  it('exports EVENT_TYPES derived from eventTypeEnum', () => {
    expect(schema.EVENT_TYPES).toEqual(['STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION']);
    expect(schema.EVENT_TYPES).toBe(schema.eventTypeEnum.enumValues);
  });

  it('exports QUESTION_PRIORITIES derived from questionPriorityEnum', () => {
    expect(schema.QUESTION_PRIORITIES).toEqual(['critical', 'important', 'nice_to_have']);
    expect(schema.QUESTION_PRIORITIES).toBe(schema.questionPriorityEnum.enumValues);
  });

  it('exports QUESTION_STATUSES derived from questionStatusEnum', () => {
    expect(schema.QUESTION_STATUSES).toEqual(['open', 'sent', 'resolved']);
    expect(schema.QUESTION_STATUSES).toBe(schema.questionStatusEnum.enumValues);
  });

  it('exports SNAPSHOT_TRIGGERS derived from snapshotTriggerEnum', () => {
    expect(schema.SNAPSHOT_TRIGGERS).toEqual(['synthesis_apply', 'validation_merge']);
    expect(schema.SNAPSHOT_TRIGGERS).toBe(schema.snapshotTriggerEnum.enumValues);
  });

  it('exports ARTIFACT_STAGES derived from artifactStageEnum', () => {
    expect(schema.ARTIFACT_STAGES).toEqual(['input', 'intermediate', 'output', 'reference']);
    expect(schema.ARTIFACT_STAGES).toBe(schema.artifactStageEnum.enumValues);
  });
});

describe('Schema union types exist', () => {
  // These are compile-time checks — if they fail, TypeScript will error
  it('ClientStatus type matches enum values', () => {
    const val: schema.ClientStatus = 'prospecting';
    expect(schema.CLIENT_STATUSES).toContain(val);
  });

  it('ProcessStatus type matches enum values', () => {
    const val: schema.ProcessStatus = 'draft';
    expect(schema.PROCESS_STATUSES).toContain(val);
  });

  it('SessionType type matches enum values', () => {
    const val: schema.SessionType = 'discovery';
    expect(schema.SESSION_TYPES).toContain(val);
  });

  it('SessionStatus type matches enum values', () => {
    const val: schema.SessionStatus = 'planned';
    expect(schema.SESSION_STATUSES).toContain(val);
  });

  it('EventType type matches enum values', () => {
    const val: schema.EventType = 'STEP';
    expect(schema.EVENT_TYPES).toContain(val);
  });

  it('QuestionPriority type matches enum values', () => {
    const val: schema.QuestionPriority = 'critical';
    expect(schema.QUESTION_PRIORITIES).toContain(val);
  });

  it('QuestionStatus type matches enum values', () => {
    const val: schema.QuestionStatus = 'open';
    expect(schema.QUESTION_STATUSES).toContain(val);
  });

  it('SnapshotTrigger type matches enum values', () => {
    const val: schema.SnapshotTrigger = 'synthesis_apply';
    expect(schema.SNAPSHOT_TRIGGERS).toContain(val);
  });
});
