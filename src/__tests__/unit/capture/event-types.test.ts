import { describe, it, expect } from 'vitest'
import {
  EVENT_TYPE_CONFIG,
  getEventTypeConfig,
  DEFAULT_SYSTEM_OPTIONS,
} from '@/lib/capture/event-types'
import { EVENT_TYPES } from '@/lib/db/schema'

describe('Event Type Config', () => {
  it('EVENT_TYPES constant has exactly 5 values', () => {
    expect(EVENT_TYPES).toEqual(['STEP', 'EDGE', 'SYSTEM', 'IMPLICIT', 'QUESTION'])
  })

  it('has a config entry for every EVENT_TYPE', () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_TYPE_CONFIG.find((c) => c.id === type)).toBeDefined()
    }
  })

  it('every config entry has required fields', () => {
    for (const config of EVENT_TYPE_CONFIG) {
      expect(config.id).toBeTruthy()
      expect(config.label).toBeTruthy()
      expect(config.color).toBeTruthy()
      expect(config.dotColor).toBeTruthy()
      expect(config.behavior).toMatch(/^(input_panel|system_picker|instant_log)$/)
    }
  })

  it('getEventTypeConfig returns correct config', () => {
    const step = getEventTypeConfig('STEP')
    expect(step.label).toBe('Step')
    expect(step.behavior).toBe('input_panel')
  })

  it('getEventTypeConfig throws for unknown type', () => {
    expect(() => getEventTypeConfig('INVALID' as any)).toThrow('Unknown event type')
  })

  it('DEFAULT_SYSTEM_OPTIONS has 8 entries including Other', () => {
    expect(DEFAULT_SYSTEM_OPTIONS).toHaveLength(8)
    expect(DEFAULT_SYSTEM_OPTIONS).toContain('Other')
  })
})
