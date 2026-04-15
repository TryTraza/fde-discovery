// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAgentBySlug = vi.fn()
vi.mock('@/lib/db/queries/ai-agents', () => ({
  getAgentBySlug: (slug: string) => mockGetAgentBySlug(slug),
}))

const mockGetLayer = vi.fn()
vi.mock('@/lib/ai/layers/registry', () => ({
  getLayer: (name: string) => mockGetLayer(name),
}))

const mockResolveSkills = vi.fn()
vi.mock('@/lib/ai/skills/resolver', () => ({
  resolveSkills: (slugs: string[]) => mockResolveSkills(slugs),
}))

import { buildAIInput } from '@/lib/ai/input-builder'

const FAST_RESILIENCE = { layerTimeout: 100, fallbackOnLayerError: true }

function fakeConfig(overrides?: Partial<any>) {
  return {
    slug: 'hypothesis',
    version: 1,
    mode: 'generateObject',
    model: 'standard',
    layers: [],
    skills: [],
    tools: [],
    schemaSlug: 'hypothesis',
    langfusePromptName: 'hypothesis',
    maxOutputTokens: 1000,
    resilience: FAST_RESILIENCE,
    ...overrides,
  }
}

describe('buildAIInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveSkills.mockResolvedValue({
      systemPromptFragments: [],
      contextEnrichments: {},
      instructions: [],
    })
  })

  it('throws when the agent slug is unknown', async () => {
    mockGetAgentBySlug.mockResolvedValue(null)
    await expect(buildAIInput('nope', {})).rejects.toThrow(/Unknown AI agent/)
  })

  it('returns empty structure when the agent has no layers and no skills', async () => {
    mockGetAgentBySlug.mockResolvedValue(fakeConfig())

    const result = await buildAIInput('hypothesis', { clientId: 'c1' })

    expect(result.templateVars).toEqual({})
    expect(result.layerResults).toEqual([])
    expect(result.layerData).toEqual({})
    expect(result.layerTimings).toEqual({})
    expect(result.layerErrors).toEqual([])
  })

  it('merges template vars from every resolved layer', async () => {
    mockGetAgentBySlug.mockResolvedValue(
      fakeConfig({
        layers: [
          { layer: 'l2-client', options: {} },
          { layer: 'l3-process', options: {} },
        ],
      })
    )
    mockGetLayer.mockImplementation((name: string) => ({
      name,
      resolve: async () => ({
        data: { _name: name },
        templateVars:
          name === 'l2-client'
            ? { clientName: 'Acme', clientIndustry: 'Manufacturing' }
            : { processName: 'PO' },
      }),
    }))

    const result = await buildAIInput('hypothesis', { clientId: 'c1', processId: 'p1' })

    expect(result.templateVars).toEqual({
      clientName: 'Acme',
      clientIndustry: 'Manufacturing',
      processName: 'PO',
    })
    expect(result.layerData).toEqual({
      'l2-client': { _name: 'l2-client' },
      'l3-process': { _name: 'l3-process' },
    })
  })

  it('layers that time out fall back to empty results (resilience)', async () => {
    mockGetAgentBySlug.mockResolvedValue(
      fakeConfig({ layers: [{ layer: 'l2-client', options: {} }] })
    )
    mockGetLayer.mockReturnValue({
      name: 'l2-client',
      resolve: () => new Promise((resolve) => setTimeout(resolve, 500)),
    })

    const result = await buildAIInput('hypothesis', { clientId: 'c1' })

    expect(result.templateVars).toEqual({})
    expect(result.layerErrors[0].layer).toBe('l2-client')
    expect(result.layerErrors[0].error).toMatch(/timed out/)
  })

  it('skill contextEnrichments overlay on top of layer vars', async () => {
    mockGetAgentBySlug.mockResolvedValue(
      fakeConfig({
        layers: [{ layer: 'l2-client', options: {} }],
        skills: ['domain-language'],
      })
    )
    mockGetLayer.mockReturnValue({
      name: 'l2-client',
      resolve: async () => ({
        data: {},
        templateVars: { tone: 'factual' },
      }),
    })
    mockResolveSkills.mockResolvedValue({
      systemPromptFragments: ['Be terse'],
      contextEnrichments: { tone: 'professional' },
      instructions: [],
    })

    const result = await buildAIInput('hypothesis', {})
    expect(result.templateVars.tone).toBe('professional')
    expect(result.skills.systemPromptFragments).toContain('Be terse')
  })

  it('caller overrides win over both layers and skills', async () => {
    mockGetAgentBySlug.mockResolvedValue(
      fakeConfig({
        layers: [{ layer: 'l2-client', options: {} }],
        skills: ['domain-language'],
      })
    )
    mockGetLayer.mockReturnValue({
      name: 'l2-client',
      resolve: async () => ({ data: {}, templateVars: { tone: 'factual' } }),
    })
    mockResolveSkills.mockResolvedValue({
      systemPromptFragments: [],
      contextEnrichments: { tone: 'professional' },
      instructions: [],
    })

    const result = await buildAIInput(
      'hypothesis',
      {},
      { overrides: { templateVars: { tone: 'playful' } } }
    )
    expect(result.templateVars.tone).toBe('playful')
  })
})
