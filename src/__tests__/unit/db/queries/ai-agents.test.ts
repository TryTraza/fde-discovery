import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module
vi.mock('@/lib/db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// We need to mock the schema to avoid import issues in test env
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return actual;
});

import { db } from '@/lib/db/index';
import {
  getAgentBySlug,
  listAgents,
  upsertAgent,
} from '@/lib/db/queries/ai-agents';

// Helper to create a fake agent row
function fakeAgentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    slug: 'capture-suggestions',
    label: 'Capture Suggestions',
    description: 'Real-time suggestions during shadowing',
    mode: 'generateObject',
    model: 'fast',
    layers: [
      { layer: 'l1-domain', options: { mode: 'matched' } },
      { layer: 'l3-process', options: { includeModel: true, fields: 'full' } },
    ],
    langfusePromptName: 'capture-suggestions',
    schemaSlug: 'capture-suggestions',
    tools: [],
    maxOutputTokens: 500,
    skills: ['process-archaeology'],
    resilience: { layerTimeout: 3000, totalTimeout: 8000, fallbackOnLayerError: true },
    enabled: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockSelectChain(rows: any[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  vi.mocked(db.select).mockReturnValue(chain as any);
  return chain;
}

describe('getAgentBySlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns agent config for valid slug', async () => {
    const row = fakeAgentRow();
    mockSelectChain([row]);

    const result = await getAgentBySlug('capture-suggestions');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('capture-suggestions');
    expect(result!.layers).toHaveLength(2);
    expect(result!.resilience.layerTimeout).toBe(3000);
  });

  it('returns null for nonexistent slug', async () => {
    mockSelectChain([]);
    const result = await getAgentBySlug('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for disabled agent (query filters by enabled=true)', async () => {
    // The query itself filters for enabled=true, so disabled agents return empty
    mockSelectChain([]);
    const result = await getAgentBySlug('disabled-agent');
    expect(result).toBeNull();
  });

  it('returns config with tools when present', async () => {
    const row = fakeAgentRow({
      slug: 'company-research',
      tools: [{ tool: 'web-search', options: { maxSteps: 3 } }],
    });
    mockSelectChain([row]);

    const result = await getAgentBySlug('company-research');
    expect(result!.tools).toEqual([{ tool: 'web-search', options: { maxSteps: 3 } }]);
  });
});

describe('listAgents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all agents (enabled and disabled)', async () => {
    const agents = [
      fakeAgentRow({ slug: 'agent-a', enabled: true }),
      fakeAgentRow({ slug: 'agent-b', enabled: false }),
    ];
    const chain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(agents),
    };
    vi.mocked(db.select).mockReturnValue(chain as any);

    const result = await listAgents();
    expect(result).toHaveLength(2);
  });
});

describe('upsertAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates new agent with version 1 when slug does not exist', async () => {
    // Mock select returning empty (no existing agent)
    mockSelectChain([]);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([fakeAgentRow({ version: 1 })]),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const result = await upsertAgent({
      slug: 'new-agent',
      label: 'New Agent',
      mode: 'generateText' as const,
      model: 'standard' as const,
      layers: [],
      langfusePromptName: 'new-agent',
      schemaSlug: null,
      tools: [],
      maxOutputTokens: 1000,
      skills: [],
      resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: true },
    });

    expect(result.version).toBe(1);
    expect(db.insert).toHaveBeenCalled();
  });

  it('updates existing agent and increments version', async () => {
    const existing = fakeAgentRow({ version: 2 });
    mockSelectChain([existing]);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ ...existing, version: 3 }]),
    };
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const result = await upsertAgent({
      slug: 'capture-suggestions',
      label: 'Updated Label',
      mode: 'generateObject' as const,
      model: 'fast' as const,
      layers: [],
      langfusePromptName: 'capture-suggestions',
      schemaSlug: 'capture-suggestions',
      tools: [],
      maxOutputTokens: 500,
      skills: [],
      resilience: { layerTimeout: 3000, totalTimeout: 8000, fallbackOnLayerError: true },
    });

    expect(result.version).toBe(3);
    expect(db.update).toHaveBeenCalled();
  });
});
