import { describe, it, expect } from 'vitest'
import { getTool, listAvailableTools } from '@/lib/ai/tools/registry'

describe('Tool Registry', () => {
  it('getTool("web-search") returns entry with factory function', () => {
    const entry = getTool('web-search')
    expect(entry.slug).toBe('web-search')
    expect(typeof entry.factory).toBe('function')
  })

  it('getTool("nonexistent") throws with descriptive error', () => {
    expect(() => getTool('nonexistent')).toThrow(/nonexistent/)
    expect(() => getTool('nonexistent')).toThrow(/Available/)
  })

  it('listAvailableTools returns array with slug, label, description', () => {
    const tools = listAvailableTools()
    expect(tools.length).toBeGreaterThanOrEqual(1)
    for (const entry of tools) {
      expect(entry.slug).toBeTruthy()
      expect(entry.label).toBeTruthy()
      expect(entry.description).toBeTruthy()
    }
  })

  it('getTool("web-search").factory(mockAnthropic) returns a tool object', () => {
    const entry = getTool('web-search')
    const mockAnthropic = {
      tools: { webSearch_20250305: () => ({ type: 'web_search' }) },
    }
    const tool = entry.factory(mockAnthropic)
    expect(tool).toBeDefined()
  })

  it('getTool("web-search").factory(null) handles missing anthropic', () => {
    const entry = getTool('web-search')
    expect(() => entry.factory(null)).toThrow()
  })
})
