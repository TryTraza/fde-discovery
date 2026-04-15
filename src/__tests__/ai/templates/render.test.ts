import { describe, expect, it } from 'vitest'
import { renderTemplate } from '@/lib/ai/templates/render'

describe('renderTemplate', () => {
  it('renders sections in order separated by blank lines', () => {
    const out = renderTemplate([{ body: 'first' }, { body: 'second' }])
    expect(out).toBe('first\n\nsecond')
  })

  it('skips sections with when: false', () => {
    const out = renderTemplate([{ body: 'kept' }, { when: false, body: 'dropped' }])
    expect(out).toBe('kept')
  })

  it('treats when undefined as true (default render)', () => {
    const out = renderTemplate([{ body: 'always' }])
    expect(out).toBe('always')
  })

  it('skips sections with empty body (after trim)', () => {
    const out = renderTemplate([{ body: '   ' }, { body: 'kept' }, { body: '' }])
    expect(out).toBe('kept')
  })

  it('prepends markdown H2 when heading is provided', () => {
    const out = renderTemplate([{ heading: 'Summary', body: 'one line' }])
    expect(out).toBe('## Summary\none line')
  })

  it('calls body when it is a function (lazy)', () => {
    let called = 0
    const lazy = () => {
      called++
      return 'computed'
    }
    const out = renderTemplate([{ body: lazy }])
    expect(out).toBe('computed')
    expect(called).toBe(1)
  })

  it('does not invoke the body function when when=false', () => {
    let called = 0
    renderTemplate([
      {
        when: false,
        body: () => {
          called++
          return 'x'
        },
      },
    ])
    expect(called).toBe(0)
  })

  it('is deterministic across repeated calls', () => {
    const sections = [{ heading: 'A', body: '1' }, { when: false, body: 'skip' }, { body: '2' }]
    const a = renderTemplate(sections)
    const b = renderTemplate(sections)
    expect(a).toEqual(b)
  })
})
