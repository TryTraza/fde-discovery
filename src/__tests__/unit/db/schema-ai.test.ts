import { describe, it, expect } from 'vitest';
import * as schema from '@/lib/db/schema';

describe('AI Agents Schema', () => {
  it('exports aiAgents table with all required columns', () => {
    const cols = Object.keys(schema.aiAgents);
    const expected = [
      'id', 'slug', 'label', 'description', 'mode', 'model',
      'layers', 'langfusePromptName', 'schemaSlug', 'tools',
      'maxOutputTokens', 'skills', 'resilience', 'enabled',
      'version', 'createdAt', 'updatedAt',
    ];
    for (const c of expected) expect(cols).toContain(c);
  });

  it('exports skills table with all required columns', () => {
    const cols = Object.keys(schema.skills);
    const expected = [
      'id', 'slug', 'label', 'description', 'type', 'content',
      'enabled', 'createdAt', 'updatedAt', 'deletedAt',
    ];
    for (const c of expected) expect(cols).toContain(c);
  });
});

describe('AI Enums', () => {
  it('exports aiModeEnum with correct values', () => {
    expect(schema.aiModeEnum.enumValues).toEqual(['generateObject', 'generateText', 'streamText']);
  });

  it('exports modelTierEnum with correct values', () => {
    expect(schema.modelTierEnum.enumValues).toEqual(['fast', 'standard']);
  });

  it('exports skillTypeEnum with correct values', () => {
    expect(schema.skillTypeEnum.enumValues).toEqual(['system-prompt', 'context-enrichment', 'instruction']);
  });
});
