import { describe, expect, it } from 'vitest'
import { FEATURES, getFeatureConfig, listFeatureSlugs } from '@/lib/ai/features/registry'

const EXPECTED_SLUGS = [
  'capture-suggestions',
  'company-research',
  'email-draft',
  'prep-brief',
  'process-hypothesis',
  'research-chat',
  'session-interview',
  'session-synthesis',
  'shadowing-synthesis',
] as const

describe('features registry', () => {
  it('exports every expected feature slug', () => {
    expect(listFeatureSlugs().sort()).toEqual([...EXPECTED_SLUGS].sort())
  })

  it('returns null for an unknown slug', () => {
    expect(getFeatureConfig('does-not-exist')).toBeNull()
  })

  it.each(EXPECTED_SLUGS)(
    'feature %s has internally consistent config',
    (slug) => {
      const f = getFeatureConfig(slug)
      expect(f).not.toBeNull()
      if (!f) return
      expect(f.slug).toBe(slug)
      expect(f.label.length).toBeGreaterThan(0)
      expect(['generateObject', 'generateText', 'streamText']).toContain(f.mode)
      expect(['fast', 'standard']).toContain(f.model)
      expect(f.maxOutputTokens).toBeGreaterThan(0)
      if (f.mode === 'generateObject') {
        expect(f.schemaSlug).not.toBeNull()
      }
      expect(f.resilience.layerTimeout).toBeGreaterThan(0)
      expect(f.resilience.totalTimeout).toBeGreaterThan(0)
    }
  )

  it('does not share object references between features (no accidental aliasing)', () => {
    const ids = new Set(Object.values(FEATURES).map((f) => f))
    expect(ids.size).toBe(Object.keys(FEATURES).length)
  })
})
