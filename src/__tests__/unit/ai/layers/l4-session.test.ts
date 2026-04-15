import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  listSessionContacts: vi.fn(),
  getCompletedSessionsByProcess: vi.fn(),
}))

vi.mock('@/lib/db/queries/events', () => ({
  getEventsBySessionId: vi.fn(),
}))

import {
  getSessionById,
  listSessionContacts,
  getCompletedSessionsByProcess,
} from '@/lib/db/queries/sessions'
import { getEventsBySessionId } from '@/lib/db/queries/events'
import { l4SessionLayer } from '@/lib/ai/layers/l4-session'

const fakeSession = {
  id: 'sess-1',
  processId: 'proc-1',
  type: 'shadowing',
  title: 'Shadowing session 1',
  date: '2026-03-20',
  status: 'completed',
  interviewAnswers: { q1: 'answer1' },
  transcriptText: 'Observed operator opening ERP...',
  notes: 'Key observation: manual step at step 3',
  debriefAnswers: { summary: 'Good session' },
}

const fakeEvents = [
  { id: 'e1', type: 'STEP', label: 'Open ERP', detail: null, timestamp: new Date() },
  { id: 'e2', type: 'STEP', label: 'Check PO', detail: 'PO-12345', timestamp: new Date() },
  { id: 'e3', type: 'EDGE', label: 'Rush order', detail: null, timestamp: new Date() },
]

const fakeContacts = [
  { id: 'c1', name: 'Jane Doe', role: 'Procurement Manager', department: 'Finance' },
]

const fakePriorSessions = [
  {
    id: 'sess-0',
    type: 'discovery',
    title: 'Initial discovery',
    status: 'synthesis_done',
    transcriptText: 'Prior transcript',
    notes: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSessionById).mockResolvedValue(fakeSession as any)
  vi.mocked(getEventsBySessionId).mockResolvedValue(fakeEvents as any)
  vi.mocked(listSessionContacts).mockResolvedValue(fakeContacts as any)
  vi.mocked(getCompletedSessionsByProcess).mockResolvedValue(fakePriorSessions as any)
})

describe('L4 Session Layer', () => {
  it('requires sessionId — returns empty LayerResult without it', async () => {
    const result = await l4SessionLayer.resolve({})
    expect(result.templateVars).toEqual({})
    expect(result.data).toEqual({})
  })

  it('events "all" includes all events in sessionEventsSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'all', contacts: false, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.sessionEventsSection).toContain('Open ERP')
    expect(result.templateVars.sessionEventsSection).toContain('Check PO')
    expect(result.templateVars.sessionEventsSection).toContain('Rush order')
  })

  it('events "last20" includes last 20 events', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'last20', contacts: false, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.sessionEventsSection).toContain('Open ERP')
    expect(getEventsBySessionId).toHaveBeenCalledWith('sess-1')
  })

  it('events "none" returns empty sessionEventsSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: false, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.sessionEventsSection).toBe('')
    expect(getEventsBySessionId).not.toHaveBeenCalled()
  })

  it('contacts: true includes contactsSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: true, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.contactsSection).toContain('Jane Doe')
    expect(result.templateVars.contactsSection).toContain('Procurement Manager')
  })

  it('contacts: false returns empty contactsSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: false, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.contactsSection).toBe('')
    expect(listSessionContacts).not.toHaveBeenCalled()
  })

  it('priorSessions: true includes priorSessionsSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: false, priorSessions: true, debrief: false }
    )
    expect(result.templateVars.priorSessionsSection).toContain('Initial discovery')
  })

  it('debrief: true includes debriefSection', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: false, priorSessions: false, debrief: true }
    )
    expect(result.templateVars.debriefSection).toContain('Good session')
  })

  it('includes session transcript and notes in templateVars', async () => {
    const result = await l4SessionLayer.resolve(
      { sessionId: 'sess-1' },
      { events: 'none', contacts: false, priorSessions: false, debrief: false }
    )
    expect(result.templateVars.sessionTranscript).toContain('Observed operator')
    expect(result.templateVars.sessionNotes).toContain('manual step')
  })
})
