import { describe, it, expect } from 'vitest';
import { SESSION_TYPES, SESSION_STATUSES } from '@/lib/db/schema';
import { createSessionSchema, updateSessionSchema, interviewRequestSchema } from '@/lib/validations/session';

describe('Session validation schemas derive from schema enums', () => {
  it('createSessionSchema accepts all schema session types', () => {
    for (const type of SESSION_TYPES) {
      const result = createSessionSchema.safeParse({
        processId: 'a1000000-0000-4000-8000-000000000001',
        type,
        title: 'Test',
        date: '2026-03-15',
      });
      expect(result.success, `type "${type}" should be valid`).toBe(true);
    }
  });

  it('createSessionSchema rejects unknown session types', () => {
    const result = createSessionSchema.safeParse({
      processId: 'a1000000-0000-4000-8000-000000000001',
      type: 'fake_type',
      title: 'Test',
      date: '2026-03-15',
    });
    expect(result.success).toBe(false);
  });

  it('updateSessionSchema accepts all schema session statuses', () => {
    for (const status of SESSION_STATUSES) {
      const result = updateSessionSchema.safeParse({ status });
      expect(result.success, `status "${status}" should be valid`).toBe(true);
    }
  });

  it('interviewRequestSchema accepts all session types', () => {
    for (const type of SESSION_TYPES) {
      const result = interviewRequestSchema.safeParse({
        processId: 'a1000000-0000-4000-8000-000000000001',
        sessionType: type,
        previousAnswers: [],
        questionIndex: 0,
      });
      expect(result.success, `sessionType "${type}" should be valid`).toBe(true);
    }
  });
});
