import { describe, expect, it } from 'vitest'
import { renderEmailDraftTemplate } from '@/lib/ai/templates/email-draft'

describe('renderEmailDraftTemplate', () => {
  it('matches the baseline snapshot for a populated input', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme Corp',
      processName: 'Purchase Order Approval',
      contacts: [
        { name: 'Jane Doe', role: 'Procurement Lead' },
        { name: 'John Smith', role: null },
      ],
      synthesisHighlights: 'POs under $10k auto-approve; above go to Finance.',
      openQuestions: [
        'What is the SLA for Finance approval?',
        'Are rush POs logged separately?',
      ],
      languageInstruction: 'Write the email in English.',
    })
    expect(out).toMatchInlineSnapshot(`
      "## Session
      - Client: Acme Corp
      - Process: Purchase Order Approval
      - Contacts: Jane Doe (Procurement Lead), John Smith

      ## Highlights
      POs under \$10k auto-approve; above go to Finance.

      ## Open questions
      1. What is the SLA for Finance approval?
      2. Are rush POs logged separately?

      ## Output language
      Write the email in English."
    `)
  })

  it('omits the open-questions section when there are none', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'highlights',
      openQuestions: [],
      languageInstruction: 'Write the email in English.',
    })
    expect(out).not.toContain('Open questions')
    expect(out).toContain('## Highlights')
  })

  it('renders contact without role cleanly', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'x',
      openQuestions: [],
      languageInstruction: 'Write the email in English.',
    })
    expect(out).toContain('Contacts: Jane')
    expect(out).not.toContain('Jane (')
  })

  it('does not leak persona or task instructions into the template', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'x',
      openQuestions: [],
      languageInstruction: 'Write the email in English.',
    })
    // Persona & task instructions live in systemPrompt, not in the template.
    expect(out.toLowerCase()).not.toContain('you are')
    expect(out.toLowerCase()).not.toContain('draft a warm')
    expect(out.toLowerCase()).not.toContain('forward deployed engineer')
  })

  it('includes the language directive as its own section', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'x',
      openQuestions: [],
      languageInstruction: 'Write the email entirely in Spanish (formal business Spanish).',
    })
    expect(out).toContain('## Output language')
    expect(out).toContain('Spanish')
  })
})
