import { describe, expect, it } from 'vitest'
import {
  renderClientResearchDiscoveryTemplate,
  renderClientResearchExtractionTemplate,
} from '@/lib/ai/templates/client-research'

describe('renderClientResearchDiscoveryTemplate', () => {
  it('renders the Company block with name / industry / website', () => {
    const out = renderClientResearchDiscoveryTemplate({
      name: 'Acme Corp',
      industry: 'Manufacturing',
      website: 'https://acme.example.com',
    })
    expect(out).toContain('## Company')
    expect(out).toContain('Acme Corp')
    expect(out).toContain('Manufacturing')
    expect(out).toContain('https://acme.example.com')
  })

  it('omits the website line when null', () => {
    const out = renderClientResearchDiscoveryTemplate({
      name: 'Acme Corp',
      industry: 'Manufacturing',
      website: null,
    })
    expect(out).toContain('## Company')
    expect(out).toContain('Acme Corp')
    expect(out).not.toContain('Website')
  })

  it('does not leak persona or task instructions', () => {
    const out = renderClientResearchDiscoveryTemplate({
      name: 'Acme',
      industry: 'Manufacturing',
      website: null,
    })
    expect(out.toLowerCase()).not.toContain('you are')
    expect(out.toLowerCase()).not.toContain('cite every')
  })
})

describe('renderClientResearchExtractionTemplate', () => {
  const baseInput = {
    name: 'Acme Corp',
    industry: 'Manufacturing',
    website: 'https://acme.example.com',
    researchProse: 'Acme is a mid-size manufacturer of widgets.',
    sources: [
      { title: 'Acme homepage', url: 'https://acme.example.com' },
      { title: 'Widget Weekly', url: 'https://widgetweekly.example.com/acme' },
    ],
  }

  it('renders Company, Research material, and Discovered sources blocks', () => {
    const out = renderClientResearchExtractionTemplate(baseInput)
    expect(out).toContain('## Company')
    expect(out).toContain('## Research material')
    expect(out).toContain('## Discovered sources')
  })

  it('includes the discovery prose in the Research material section', () => {
    const out = renderClientResearchExtractionTemplate(baseInput)
    expect(out).toContain(baseInput.researchProse)
  })

  it('lists every discovered source URL', () => {
    const out = renderClientResearchExtractionTemplate(baseInput)
    for (const s of baseInput.sources) {
      expect(out).toContain(s.url)
    }
  })

  it('omits the Discovered sources section when the sources list is empty', () => {
    const out = renderClientResearchExtractionTemplate({ ...baseInput, sources: [] })
    expect(out).not.toContain('## Discovered sources')
  })
})
