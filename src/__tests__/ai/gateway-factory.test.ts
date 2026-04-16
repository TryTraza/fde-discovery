// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the heavy import chain pulled in by gateway-local (Drizzle / env).
// The factory test only exercises slug routing, never invokes a method,
// so an empty stub is fine.
vi.mock('@/lib/ai/input-builder', () => ({ buildAIInput: vi.fn() }))

import {
  __resetGatewayFactoryCache,
  getAIGateway,
} from '@/lib/ai/gateway-factory'
import { localAIGateway } from '@/lib/ai/gateway-local'
import { trazaAIGateway } from '@/lib/ai/gateway-traza'

const ENV_VAR = 'AI_GATEWAY_TRAZA'
let original: string | undefined

beforeEach(() => {
  original = process.env[ENV_VAR]
  delete process.env[ENV_VAR]
  __resetGatewayFactoryCache()
})

afterEach(() => {
  if (original === undefined) delete process.env[ENV_VAR]
  else process.env[ENV_VAR] = original
  __resetGatewayFactoryCache()
})

describe('getAIGateway', () => {
  it('returns the local gateway for every slug when AI_GATEWAY_TRAZA is unset', () => {
    expect(getAIGateway('email-draft')).toBe(localAIGateway)
    expect(getAIGateway('session-synthesis')).toBe(localAIGateway)
  })

  it('routes a single slug to Traza when listed', () => {
    process.env[ENV_VAR] = 'email-draft'
    __resetGatewayFactoryCache()
    expect(getAIGateway('email-draft')).toBe(trazaAIGateway)
    expect(getAIGateway('session-synthesis')).toBe(localAIGateway)
  })

  it('routes a comma-separated set of slugs to Traza', () => {
    process.env[ENV_VAR] = 'email-draft, session-interview'
    __resetGatewayFactoryCache()
    expect(getAIGateway('email-draft')).toBe(trazaAIGateway)
    expect(getAIGateway('session-interview')).toBe(trazaAIGateway)
    expect(getAIGateway('prep-brief')).toBe(localAIGateway)
  })

  it('routes everything to Traza when "all" is set', () => {
    process.env[ENV_VAR] = 'all'
    __resetGatewayFactoryCache()
    expect(getAIGateway('email-draft')).toBe(trazaAIGateway)
    expect(getAIGateway('session-synthesis')).toBe(trazaAIGateway)
    expect(getAIGateway('research-chat')).toBe(trazaAIGateway)
  })
})
