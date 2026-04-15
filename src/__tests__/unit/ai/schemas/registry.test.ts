import { describe, it, expect } from 'vitest';
import { getSchema, listAvailableSchemas } from '@/lib/ai/schemas/registry';

describe('Schema Registry', () => {
  it('getSchema("capture-suggestions") returns a Zod schema', () => {
    const schema = getSchema('capture-suggestions');
    expect(schema).toBeDefined();
    expect(typeof schema.parse).toBe('function');
  });

  it('getSchema("process-hypothesis") returns a Zod schema', () => {
    const schema = getSchema('process-hypothesis');
    expect(schema).toBeDefined();
  });

  it('getSchema("session-interview") returns a Zod schema', () => {
    const schema = getSchema('session-interview');
    expect(schema).toBeDefined();
  });

  it('getSchema("prep-brief") returns a Zod schema', () => {
    const schema = getSchema('prep-brief');
    expect(schema).toBeDefined();
  });

  it('getSchema("session-synthesis") returns a Zod schema', () => {
    const schema = getSchema('session-synthesis');
    expect(schema).toBeDefined();
  });

  it('getSchema("shadowing-synthesis") returns a Zod schema', () => {
    const schema = getSchema('shadowing-synthesis');
    expect(schema).toBeDefined();
  });

  it('getSchema("nonexistent") throws with descriptive error', () => {
    expect(() => getSchema('nonexistent')).toThrow(/nonexistent/);
    expect(() => getSchema('nonexistent')).toThrow(/Available/);
  });

  it('listAvailableSchemas returns array with slug, label, description', () => {
    const schemas = listAvailableSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(6);
    for (const entry of schemas) {
      expect(entry.slug).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });
});
