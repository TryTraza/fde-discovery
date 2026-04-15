import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return actual;
});

import { db } from '@/lib/db/index';
import {
  createSkill,
  listSkills,
  getSkillsBySlugs,
  updateSkill,
  softDeleteSkill,
} from '@/lib/db/queries/skills';

function fakeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    slug: 'process-archaeology',
    label: 'Process Archaeology',
    description: 'Domain knowledge for legacy process analysis',
    type: 'system-prompt',
    content: 'When analyzing legacy processes, always look for...',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('createSkill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts and returns a skill with id', async () => {
    const skill = fakeSkill();
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([skill]),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const result = await createSkill({
      slug: 'process-archaeology',
      label: 'Process Archaeology',
      type: 'system-prompt' as const,
      content: 'When analyzing legacy processes...',
    });

    expect(result.id).toBeDefined();
    expect(result.slug).toBe('process-archaeology');
  });
});

describe('listSkills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all non-deleted skills ordered by label', async () => {
    const skills = [fakeSkill({ slug: 'a-skill' }), fakeSkill({ slug: 'b-skill' })];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(skills),
    };
    vi.mocked(db.select).mockReturnValue(chain as any);

    const result = await listSkills();
    expect(result).toHaveLength(2);
  });
});

describe('getSkillsBySlugs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for empty input without DB call', async () => {
    const result = await getSkillsBySlugs([]);
    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns matching enabled skills', async () => {
    const skills = [fakeSkill()];
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(skills),
    };
    vi.mocked(db.select).mockReturnValue(chain as any);

    const result = await getSkillsBySlugs(['process-archaeology']);
    expect(result).toHaveLength(1);
  });
});

describe('updateSkill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates and returns skill', async () => {
    const updated = fakeSkill({ content: 'new content' });
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const result = await updateSkill(updated.id as string, { content: 'new content' });
    expect(result.content).toBe('new content');
  });
});

describe('softDeleteSkill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets deletedAt timestamp', async () => {
    const deleted = fakeSkill({ deletedAt: new Date() });
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([deleted]),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const result = await softDeleteSkill(deleted.id as string);
    expect(result.deletedAt).not.toBeNull();
  });
});
