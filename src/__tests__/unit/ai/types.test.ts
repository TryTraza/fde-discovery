import { describe, it, expect } from 'vitest'
import {
  aiAgentConfigSchema,
  resilienceConfigSchema,
  layerSpecSchema,
  toolSpecSchema,
} from '@/lib/ai/types'

// ── Helpers ──

function validResilience() {
  return { layerTimeout: 5000, totalTimeout: 15000, fallbackOnLayerError: true }
}

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'test-agent',
    label: 'Test Agent',
    mode: 'generateText' as const,
    model: 'standard' as const,
    layers: [],
    promptKey: 'test-prompt',
    schemaSlug: null,
    tools: [],
    maxOutputTokens: 1000,
    skills: [],
    resilience: validResilience(),
    enabled: true,
    ...overrides,
  }
}

// ── layerSpecSchema ──

describe('layerSpecSchema', () => {
  it('accepts valid layer name without options', () => {
    expect(layerSpecSchema.parse({ layer: 'l1-domain' })).toEqual({ layer: 'l1-domain' })
  })

  it('accepts valid layer name with options', () => {
    const result = layerSpecSchema.parse({ layer: 'l1-domain', options: { mode: 'matched' } })
    expect(result.options).toEqual({ mode: 'matched' })
  })

  it('rejects invalid layer name', () => {
    expect(() => layerSpecSchema.parse({ layer: 'invalid-layer' })).toThrow()
  })

  it('accepts all four valid layer names', () => {
    for (const name of ['l1-domain', 'l2-client', 'l3-process', 'l4-session']) {
      expect(() => layerSpecSchema.parse({ layer: name })).not.toThrow()
    }
  })
})

// ── toolSpecSchema ──

describe('toolSpecSchema', () => {
  it('accepts valid tool slug', () => {
    expect(toolSpecSchema.parse({ tool: 'web-search' })).toEqual({ tool: 'web-search' })
  })

  it('accepts tool with options', () => {
    const result = toolSpecSchema.parse({ tool: 'web-search', options: { maxSteps: 3 } })
    expect(result.options).toEqual({ maxSteps: 3 })
  })

  it('rejects empty string tool slug', () => {
    expect(() => toolSpecSchema.parse({ tool: '' })).toThrow()
  })
})

// ── resilienceConfigSchema ──

describe('resilienceConfigSchema', () => {
  it('accepts valid config', () => {
    const result = resilienceConfigSchema.parse(validResilience())
    expect(result.layerTimeout).toBe(5000)
  })

  it('rejects zero layerTimeout', () => {
    expect(() => resilienceConfigSchema.parse({ ...validResilience(), layerTimeout: 0 })).toThrow()
  })

  it('rejects negative layerTimeout', () => {
    expect(() => resilienceConfigSchema.parse({ ...validResilience(), layerTimeout: -1 })).toThrow()
  })

  it('rejects zero totalTimeout', () => {
    expect(() => resilienceConfigSchema.parse({ ...validResilience(), totalTimeout: 0 })).toThrow()
  })

  it('rejects missing fallbackOnLayerError', () => {
    expect(() =>
      resilienceConfigSchema.parse({ layerTimeout: 5000, totalTimeout: 15000 })
    ).toThrow()
  })
})

// ── aiAgentConfigSchema ──

describe('aiAgentConfigSchema', () => {
  it('accepts valid generateText config', () => {
    const result = aiAgentConfigSchema.parse(validConfig())
    expect(result.slug).toBe('test-agent')
  })

  it('accepts valid generateObject config with schemaSlug', () => {
    const result = aiAgentConfigSchema.parse(
      validConfig({ mode: 'generateObject', schemaSlug: 'capture-suggestions' })
    )
    expect(result.mode).toBe('generateObject')
  })

  it('rejects config missing slug', () => {
    const { slug, ...rest } = validConfig()
    expect(() => aiAgentConfigSchema.parse(rest)).toThrow()
  })

  it('rejects config missing mode', () => {
    const { mode, ...rest } = validConfig()
    expect(() => aiAgentConfigSchema.parse(rest)).toThrow()
  })

  it('rejects config missing resilience', () => {
    const { resilience, ...rest } = validConfig()
    expect(() => aiAgentConfigSchema.parse(rest)).toThrow()
  })

  it('rejects generateObject mode without schemaSlug', () => {
    expect(() =>
      aiAgentConfigSchema.parse(validConfig({ mode: 'generateObject', schemaSlug: null }))
    ).toThrow(/schemaSlug/i)
  })

  it('accepts generateText mode without schemaSlug', () => {
    expect(() =>
      aiAgentConfigSchema.parse(validConfig({ mode: 'generateText', schemaSlug: null }))
    ).not.toThrow()
  })

  it('accepts streamText mode without schemaSlug', () => {
    expect(() =>
      aiAgentConfigSchema.parse(validConfig({ mode: 'streamText', schemaSlug: null }))
    ).not.toThrow()
  })

  it('accepts empty layers array', () => {
    const result = aiAgentConfigSchema.parse(validConfig({ layers: [] }))
    expect(result.layers).toEqual([])
  })

  it('accepts config with layers', () => {
    const result = aiAgentConfigSchema.parse(
      validConfig({ layers: [{ layer: 'l1-domain', options: { mode: 'matched' } }] })
    )
    expect(result.layers).toHaveLength(1)
  })

  it('accepts empty tools array', () => {
    const result = aiAgentConfigSchema.parse(validConfig({ tools: [] }))
    expect(result.tools).toEqual([])
  })

  it('accepts config with tools', () => {
    const result = aiAgentConfigSchema.parse(validConfig({ tools: [{ tool: 'web-search' }] }))
    expect(result.tools).toHaveLength(1)
  })

  it('accepts config with tools that have options', () => {
    const result = aiAgentConfigSchema.parse(
      validConfig({ tools: [{ tool: 'web-search', options: { maxSteps: 3 } }] })
    )
    expect(result.tools[0].options).toEqual({ maxSteps: 3 })
  })

  it('rejects invalid slug format (uppercase)', () => {
    expect(() => aiAgentConfigSchema.parse(validConfig({ slug: 'InvalidSlug' }))).toThrow()
  })

  it('rejects empty slug', () => {
    expect(() => aiAgentConfigSchema.parse(validConfig({ slug: '' }))).toThrow()
  })

  it('accepts slug with hyphens and numbers', () => {
    const result = aiAgentConfigSchema.parse(validConfig({ slug: 'capture-suggestions-v2' }))
    expect(result.slug).toBe('capture-suggestions-v2')
  })

  it('defaults maxOutputTokens to 1000', () => {
    const { maxOutputTokens, ...rest } = validConfig()
    const result = aiAgentConfigSchema.parse(rest)
    expect(result.maxOutputTokens).toBe(1000)
  })

  it('defaults skills to empty array', () => {
    const { skills, ...rest } = validConfig()
    const result = aiAgentConfigSchema.parse(rest)
    expect(result.skills).toEqual([])
  })

  it('defaults enabled to true', () => {
    const { enabled, ...rest } = validConfig()
    const result = aiAgentConfigSchema.parse(rest)
    expect(result.enabled).toBe(true)
  })
})
