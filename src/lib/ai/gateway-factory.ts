import { localAIGateway } from './gateway-local'
import { trazaAIGateway } from './gateway-traza'
import type { AIGateway } from './gateway'

const ENV_VAR = 'AI_GATEWAY_TRAZA'

let cachedTrazaSlugs: Set<string> | null = null

function trazaSlugs(): Set<string> {
  if (cachedTrazaSlugs) return cachedTrazaSlugs
  const raw = process.env[ENV_VAR] ?? ''
  cachedTrazaSlugs = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  return cachedTrazaSlugs
}

/**
 * Returns the AIGateway implementation to use for a given feature slug.
 *
 * Routing rule: feature slug is in AI_GATEWAY_TRAZA (comma-separated)
 * → TrazaAIGateway. Otherwise LocalAIGateway. Special tokens:
 *   - "all": route every feature to Traza
 *   - empty / unset: every feature stays local (current default)
 *
 * Cached on first call so route handlers don't re-parse the env var per
 * request. Reset via __resetGatewayFactoryCache() in tests.
 */
export function getAIGateway(slug: string): AIGateway {
  const slugs = trazaSlugs()
  if (slugs.has('all') || slugs.has(slug)) return trazaAIGateway
  return localAIGateway
}

/** Test-only: clears the env-cache so per-test env mutation works. */
export function __resetGatewayFactoryCache(): void {
  cachedTrazaSlugs = null
}
