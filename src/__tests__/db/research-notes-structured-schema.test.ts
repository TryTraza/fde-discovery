import { describe, expect, it } from 'vitest'
import { researchNotes, type NewResearchNote } from '@/lib/db/schema'
import { researchNoteResultSchema } from '@/lib/ai/contracts'
import { validResearchNoteResult } from '@/lib/ai/contracts/__fixtures__'

describe('researchNotes.responseStructured column', () => {
  it('is declared as a jsonb column on the research_notes table', () => {
    const col = researchNotes.responseStructured
    expect(col).toBeDefined()
    expect(col.name).toBe('response_structured')
    expect(col.dataType).toBe('json')
  })

  it('coexists with the legacy response text column', () => {
    expect(researchNotes.response).toBeDefined()
    expect(researchNotes.response.dataType).toBe('string')
  })

  it('NewResearchNote accepts a valid ResearchNoteResult', () => {
    const candidate: NewResearchNote = {
      query: 'What does Acme do?',
      response: 'Acme makes widgets.',
      responseStructured: validResearchNoteResult,
    }
    expect(researchNoteResultSchema.safeParse(candidate.responseStructured).success).toBe(true)
  })

  it('NewResearchNote accepts responseStructured being null', () => {
    const candidate: NewResearchNote = {
      query: 'q',
      response: 'r',
      responseStructured: null,
    }
    expect(candidate.responseStructured).toBeNull()
  })
})
