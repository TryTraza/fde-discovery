import { z } from 'zod'
import type { ToolRegistryEntry } from '@/lib/ai/types'

const toolRegistry: Record<string, ToolRegistryEntry> = {
  'web-search': {
    slug: 'web-search',
    label: 'Web Search',
    description: 'Anthropic built-in web search tool. Options: maxSteps (default 3).',
    optionsSchema: z.object({ maxSteps: z.number().int().positive().optional() }).optional(),
    factory: (anthropic, _options) => {
      if (!anthropic?.tools?.webSearch_20250305) {
        throw new Error('Web search requires an Anthropic provider instance')
      }
      return anthropic.tools.webSearch_20250305()
    },
  },
}

export function getTool(slug: string): ToolRegistryEntry {
  const entry = toolRegistry[slug]
  if (!entry) {
    throw new Error(`Unknown tool: "${slug}". Available: ${Object.keys(toolRegistry).join(', ')}`)
  }
  return entry
}

export function listAvailableTools(): Array<{ slug: string; label: string; description: string }> {
  return Object.values(toolRegistry).map(({ slug, label, description }) => ({
    slug,
    label,
    description,
  }))
}
