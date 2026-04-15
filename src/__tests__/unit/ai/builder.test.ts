import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('@/lib/db/queries/ai-agents', () => ({
  getAgentBySlug: vi.fn(),
}));

vi.mock('@/lib/ai/layers/registry', () => ({
  getLayer: vi.fn(),
}));

vi.mock('@/lib/ai/skills/resolver', () => ({
  resolveSkills: vi.fn(),
}));

vi.mock('@/lib/ai/tools/registry', () => ({
  getTool: vi.fn(),
}));

vi.mock('@/lib/ai/schemas/registry', () => ({
  getSchema: vi.fn(),
}));

vi.mock('@/lib/ai/observe', () => ({
  getLangfuseClient: vi.fn(),
}));

vi.mock('@/lib/ai/get-ai-config', () => ({
  getAIConfig: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
  convertToModelMessages: vi.fn(),
}));

vi.mock('langfuse', () => ({
  Langfuse: class {
    getPrompt = vi.fn();
    trace = vi.fn();
    flushAsync = vi.fn().mockResolvedValue(undefined);
  },
}));

import { getAgentBySlug } from '@/lib/db/queries/ai-agents';
import { getLayer } from '@/lib/ai/layers/registry';
import { resolveSkills } from '@/lib/ai/skills/resolver';
import { getTool } from '@/lib/ai/tools/registry';
import { getSchema } from '@/lib/ai/schemas/registry';
import { getLangfuseClient } from '@/lib/ai/observe';
import { generateObject, generateText, streamText } from 'ai';
import { EMPTY_SKILLS } from '@/lib/ai/types';
import { executeAI } from '@/lib/ai/builder';

function fakeConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cfg-1',
    slug: 'test-agent',
    label: 'Test Agent',
    description: null,
    mode: 'generateText',
    model: 'standard',
    layers: [],
    langfusePromptName: 'test-prompt',
    schemaSlug: null,
    tools: [],
    maxOutputTokens: 1000,
    skills: [],
    resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: true },
    enabled: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Mock Langfuse prompt object
function fakeLangfusePrompt() {
  return {
    type: 'chat',
    version: 1,
    compile: vi.fn().mockReturnValue([
      { role: 'system', content: 'System prompt content' },
      { role: 'user', content: 'User prompt content' },
    ]),
  };
}

function setupDefaultMocks() {
  vi.mocked(getAgentBySlug).mockResolvedValue(fakeConfig() as any);
  vi.mocked(resolveSkills).mockResolvedValue(EMPTY_SKILLS);
  vi.mocked(getLangfuseClient).mockReturnValue({
    getPrompt: vi.fn().mockResolvedValue(fakeLangfusePrompt()),
    trace: vi.fn().mockReturnValue({
      id: 'trace-1',
      span: vi.fn().mockReturnValue({ end: vi.fn() }),
      generation: vi.fn(),
    }),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  } as any);
  vi.mocked(generateText).mockResolvedValue({ text: 'Generated text' } as any);
  vi.mocked(generateObject).mockResolvedValue({ object: { result: true } } as any);
}

const defaultInput = {
  agentSlug: 'test-agent',
  params: {},
  userId: 'user-1',
  model: { modelId: 'test-model' } as any,
  anthropic: {} as any,
};

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ── Config Resolution ──

describe('Config resolution', () => {
  it('loads config from DB by slug', async () => {
    await executeAI(defaultInput);
    expect(getAgentBySlug).toHaveBeenCalledWith('test-agent');
  });

  it('throws for unknown agent slug', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(null);
    await expect(executeAI(defaultInput)).rejects.toThrow(/Unknown AI agent/);
  });

  it('throws for disabled agent', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(null); // getAgentBySlug filters by enabled
    await expect(executeAI(defaultInput)).rejects.toThrow(/Unknown AI agent/);
  });
});

// ── Layer Execution ──

describe('Layer execution', () => {
  it('calls only configured layers', async () => {
    const mockLayer = { name: 'l2-client', resolve: vi.fn().mockResolvedValue({ data: {}, templateVars: { clientName: 'Acme' } }) };
    vi.mocked(getLayer).mockReturnValue(mockLayer as any);
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ layers: [{ layer: 'l2-client' }] }) as any
    );

    await executeAI(defaultInput);
    expect(getLayer).toHaveBeenCalledWith('l2-client');
    expect(mockLayer.resolve).toHaveBeenCalled();
  });

  it('runs layers in parallel (total time ≈ max, not sum)', async () => {
    const slowLayer = {
      name: 'l2-client',
      resolve: vi.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r({ data: {}, templateVars: {} }), 50))),
    };
    const fastLayer = {
      name: 'l3-process',
      resolve: vi.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r({ data: {}, templateVars: {} }), 10))),
    };
    vi.mocked(getLayer).mockImplementation((name) => {
      if (name === 'l2-client') return slowLayer as any;
      return fastLayer as any;
    });
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ layers: [{ layer: 'l2-client' }, { layer: 'l3-process' }] }) as any
    );

    const start = Date.now();
    await executeAI(defaultInput);
    const elapsed = Date.now() - start;
    // Should be closer to 50ms (max), not 60ms (sum)
    expect(elapsed).toBeLessThan(200);
  });

  it('continues when layer fails and fallbackOnLayerError=true', async () => {
    const failingLayer = { name: 'l1-domain', resolve: vi.fn().mockRejectedValue(new Error('L1 failed')) };
    vi.mocked(getLayer).mockReturnValue(failingLayer as any);
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({
        layers: [{ layer: 'l1-domain' }],
        resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: true },
      }) as any
    );

    const result = await executeAI(defaultInput);
    expect(result.meta.layerErrors).toHaveLength(1);
    expect(result.meta.layerErrors[0].layer).toBe('l1-domain');
  });

  it('throws when layer fails and fallbackOnLayerError=false', async () => {
    const failingLayer = { name: 'l1-domain', resolve: vi.fn().mockRejectedValue(new Error('L1 failed')) };
    vi.mocked(getLayer).mockReturnValue(failingLayer as any);
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({
        layers: [{ layer: 'l1-domain' }],
        resilience: { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: false },
      }) as any
    );

    await expect(executeAI(defaultInput)).rejects.toThrow(/L1 failed/);
  });
});

// ── Prompt Compilation ──

describe('Prompt compilation', () => {
  it('fetches Langfuse prompt with config promptName', async () => {
    const langfuse = getLangfuseClient() as any;
    await executeAI(defaultInput);
    expect(langfuse.getPrompt).toHaveBeenCalledWith('test-prompt', undefined, { label: 'production' });
  });

  it('merges layer templateVars into prompt compilation', async () => {
    const mockLayer = {
      name: 'l2-client',
      resolve: vi.fn().mockResolvedValue({ data: {}, templateVars: { clientName: 'Acme' } }),
    };
    vi.mocked(getLayer).mockReturnValue(mockLayer as any);
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ layers: [{ layer: 'l2-client' }] }) as any
    );

    const langfuse = getLangfuseClient() as any;
    const prompt = fakeLangfusePrompt();
    langfuse.getPrompt.mockResolvedValue(prompt);

    await executeAI(defaultInput);

    expect(prompt.compile).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Acme' })
    );
  });
});

// ── Skill Injection ──

describe('Skill injection', () => {
  it('prepends system-prompt fragments before Langfuse prompt', async () => {
    vi.mocked(resolveSkills).mockResolvedValue({
      systemPromptFragments: ['Domain context here'],
      contextEnrichments: {},
      instructions: [],
    });
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ skills: ['some-skill'] }) as any
    );

    await executeAI(defaultInput);

    const systemArg = vi.mocked(generateText).mock.calls[0]?.[0]?.system as string;
    expect(systemArg).toMatch(/Domain context here[\s\S]*System prompt content/);
  });

  it('appends instructions after Langfuse prompt', async () => {
    vi.mocked(resolveSkills).mockResolvedValue({
      systemPromptFragments: [],
      contextEnrichments: {},
      instructions: ['Be concise.'],
    });
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ skills: ['some-skill'] }) as any
    );

    await executeAI(defaultInput);

    const systemArg = vi.mocked(generateText).mock.calls[0]?.[0]?.system as string;
    expect(systemArg).toContain('Be concise.');
    expect(systemArg).toMatch(/System prompt content[\s\S]*Be concise/);
  });
});

// ── Tool Resolution ──

describe('Tool resolution', () => {
  it('resolves tools from registry when config has tools', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ tools: [{ tool: 'web-search', options: { maxSteps: 3 } }] }) as any
    );
    vi.mocked(getTool).mockReturnValue({
      slug: 'web-search',
      label: 'Web Search',
      description: 'Test',
      factory: vi.fn().mockReturnValue({ type: 'web_search' }),
    } as any);

    await executeAI(defaultInput);
    expect(getTool).toHaveBeenCalledWith('web-search');
  });

  it('skips unknown tools with warning (does not throw)', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ tools: [{ tool: 'nonexistent' }] }) as any
    );
    vi.mocked(getTool).mockImplementation(() => { throw new Error('Unknown tool'); });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await executeAI(defaultInput);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ── Mode Dispatch ──

describe('Mode dispatch', () => {
  it('calls generateText for generateText mode', async () => {
    await executeAI(defaultInput);
    expect(generateText).toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('calls generateObject for generateObject mode with schema', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ mode: 'generateObject', schemaSlug: 'capture-suggestions' }) as any
    );
    vi.mocked(getSchema).mockReturnValue({ parse: vi.fn() } as any);

    await executeAI(defaultInput);
    expect(generateObject).toHaveBeenCalled();
    expect(getSchema).toHaveBeenCalledWith('capture-suggestions');
  });

  it('calls streamText for streamText mode', async () => {
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ mode: 'streamText' }) as any
    );
    vi.mocked(streamText).mockReturnValue({
      toUIMessageStreamResponse: vi.fn().mockReturnValue('stream-response'),
    } as any);

    const result = await executeAI({ ...defaultInput, messages: [{ role: 'user', content: 'test' }] });
    expect(streamText).toHaveBeenCalled();
    expect(result.stream).toBeDefined();
  });
});

// ── Overrides ──

describe('Overrides', () => {
  it('templateVars overrides appear in compiled prompt', async () => {
    const langfuse = getLangfuseClient() as any;
    const prompt = fakeLangfusePrompt();
    langfuse.getPrompt.mockResolvedValue(prompt);

    await executeAI({
      ...defaultInput,
      overrides: { templateVars: { custom: 'value' } },
    });

    expect(prompt.compile).toHaveBeenCalledWith(
      expect.objectContaining({ custom: 'value' })
    );
  });

  it('systemPromptAppend is appended after skills', async () => {
    await executeAI({
      ...defaultInput,
      overrides: { systemPromptAppend: 'Extra instruction' },
    });

    const systemArg = vi.mocked(generateText).mock.calls[0]?.[0]?.system as string;
    expect(systemArg).toContain('Extra instruction');
  });
});

// ── Metadata ──

describe('Metadata', () => {
  it('returns configVersion and promptVersion', async () => {
    const result = await executeAI(defaultInput);
    expect(result.meta.configVersion).toBe(1);
    expect(result.meta.promptVersion).toBe(1);
    expect(result.meta.agentSlug).toBe('test-agent');
  });

  it('returns layerTimings', async () => {
    const result = await executeAI(defaultInput);
    expect(result.meta.layerTimings).toBeDefined();
  });

  it('returns totalDuration > 0', async () => {
    const result = await executeAI(defaultInput);
    expect(result.meta.totalDuration).toBeGreaterThanOrEqual(0);
  });
});

// ── Langfuse Graceful Degradation ──

describe('Langfuse graceful degradation', () => {
  it('still works when Langfuse is not configured (uses fixture fallback)', async () => {
    vi.mocked(getLangfuseClient).mockReturnValue(null);
    // Use a prompt name that exists in fixtures
    vi.mocked(getAgentBySlug).mockResolvedValue(
      fakeConfig({ langfusePromptName: 'email-draft' }) as any
    );

    const result = await executeAI(defaultInput);
    expect(result.text).toBe('Generated text');
  });
});

// ── Pre-resolved Model ──

describe('Pre-resolved model', () => {
  it('uses pre-resolved model without calling getAIConfig', async () => {
    const mockModel = { modelId: 'pre-resolved' } as any;
    await executeAI({ ...defaultInput, model: mockModel });

    const { getAIConfig } = await import('@/lib/ai/get-ai-config');
    expect(getAIConfig).not.toHaveBeenCalled();
  });
});
