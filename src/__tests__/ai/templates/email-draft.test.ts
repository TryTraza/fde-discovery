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
    })
    expect(out).toMatchInlineSnapshot(`
      "Client: Acme Corp
      Process: Purchase Order Approval
      Contacts: Jane Doe (Procurement Lead), John Smith

      ## Session highlights
      POs under \$10k auto-approve; above go to Finance.

      ## Open questions to address
      1. What is the SLA for Finance approval?
      2. Are rush POs logged separately?

      Draft a warm, concise follow-up email (3 paragraphs max + numbered question list). Thank them for their time, summarize key takeaways, list open questions, and propose a clear next step. Respond with the email body only (no subject line, no signature)."
    `)
  })

  it('omits the open-questions section when there are none', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'highlights',
      openQuestions: [],
    })
    expect(out).not.toContain('Open questions')
    expect(out).toContain('## Session highlights')
  })

  it('renders contact without role cleanly', () => {
    const out = renderEmailDraftTemplate({
      clientName: 'Acme',
      processName: 'PO',
      contacts: [{ name: 'Jane', role: null }],
      synthesisHighlights: 'x',
      openQuestions: [],
    })
    expect(out).toContain('Contacts: Jane')
    expect(out).not.toContain('Jane (')
  })
})
