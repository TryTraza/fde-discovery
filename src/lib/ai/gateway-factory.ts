import { localAIGateway } from './gateway-local'
import type { AIGateway } from './gateway'

/**
 * Returns the AIGateway implementation to use for a given feature slug.
 *
 * Today: always the local gateway.
 * Phase 2.9: honours env var AI_GATEWAY_TRAZA (comma-separated slugs) to
 * route specific features through TrazaAIGateway while the rest stay local.
 *
 * Kept as a factory so route handlers never hard-code an implementation —
 * flipping a feature to Traza is a one-line env change, not a code change.
 */
export function getAIGateway(_slug: string): AIGateway {
  return localAIGateway
}
