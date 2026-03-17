// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { updateSessionSchema } from '@/lib/validations/session';

describe('updateSessionSchema — questionsAsked', () => {
  it('accepts questionsAsked as boolean array', () => {
    const result = updateSessionSchema.safeParse({ questionsAsked: [true, false, true] });
    expect(result.success).toBe(true);
  });

  it('accepts questionsAsked as null', () => {
    const result = updateSessionSchema.safeParse({ questionsAsked: null });
    expect(result.success).toBe(true);
  });

  it('accepts update without questionsAsked (optional)', () => {
    const result = updateSessionSchema.safeParse({ notes: 'hello' });
    expect(result.success).toBe(true);
  });

  it('rejects questionsAsked with non-boolean values', () => {
    const result = updateSessionSchema.safeParse({ questionsAsked: ['yes', 'no'] });
    expect(result.success).toBe(false);
  });

  it('accepts empty boolean array', () => {
    const result = updateSessionSchema.safeParse({ questionsAsked: [] });
    expect(result.success).toBe(true);
  });
});
