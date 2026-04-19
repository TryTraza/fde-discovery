import type { ClientResearchPayload, GeneratedClientResearch } from '../client-research'
import type { ProcessGraph } from '../process-graph'
import type { ProcessHypothesis } from '../process-hypothesis'
import type { ResearchNoteResult } from '../research-note-result'
import type { SynthesisOutput } from '../synthesis-output'

export const validProcessGraph: ProcessGraph = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'n1',
      type: 'terminal',
      label: 'Start',
      confidence: 'confirmed',
      metadata: { kind: 'start' },
    },
    {
      id: 'n2',
      type: 'step',
      label: 'Receive PO',
      confidence: 'confirmed',
      metadata: { actor: 'buyer', systems: ['SAP'] },
    },
    {
      id: 'n3',
      type: 'decision',
      label: 'Over $10k?',
      confidence: 'inferred',
      metadata: {},
    },
    {
      id: 'n4',
      type: 'terminal',
      label: 'End',
      confidence: 'confirmed',
      metadata: { kind: 'end' },
    },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', type: 'sequence' },
    { id: 'e2', from: 'n2', to: 'n3', type: 'sequence' },
    { id: 'e3', from: 'n3', to: 'n4', type: 'conditional', condition: 'approved' },
  ],
  edgeCases: [
    {
      id: 'ec1',
      description: 'Vendor not in system',
      affectedNodeIds: ['n2'],
      frequency: 'occasional',
      status: 'open',
    },
  ],
}

export const validProcessHypothesis: ProcessHypothesis = {
  schemaVersion: 1,
  summary: 'Purchase order approval handled manually through email and SAP.',
  triggers: [{ description: 'New PO request submitted', frequency: 'daily' }],
  stakeholders: [
    { role: 'Buyer', responsibility: 'Submits PO' },
    { role: 'Finance', responsibility: 'Approves PO > $10k' },
  ],
  inputs: [{ name: 'PO request form', format: 'PDF' }],
  outputs: [{ name: 'Approved PO', consumer: 'Vendor' }],
  expectedSystems: [{ name: 'SAP', purpose: 'PO tracking', confidence: 'high' }],
  assumptions: [
    {
      text: 'All POs flow through SAP',
      confidence: 'medium',
      validationQuestion: 'Are there off-system POs?',
    },
  ],
  openQuestions: ['What is the SLA for approvals?'],
  generatedAt: '2026-04-15T10:00:00.000Z',
}

export const validGeneratedClientResearch: GeneratedClientResearch = {
  companyOverview: 'Acme Corp designs and manufactures widgets for enterprise buyers.',
  sizeFinancials: '500 employees, ~$120M ARR, growth-stage.',
  customersMarkets: 'Enterprise manufacturing buyers across EMEA.',
  painPoints: 'Manual PO approvals and fragmented supply-chain visibility.',
  recentNews: 'Raised a Series C in early 2026 focused on US expansion.',
  fitScore: 8,
  fitScoreRationale: 'Strong process-modernisation appetite with clear manual bottlenecks.',
  areasOfExpertise: ['Widget engineering', 'Supply chain'],
  productsAndServices: ['Widget Pro — Industrial-grade widget platform'],
  keyStakeholders: ['Jane Doe | COO | https://www.linkedin.com/in/janedoe'],
  techStack: ['SAP S/4HANA', 'Salesforce'],
}

export const validClientResearch: ClientResearchPayload = {
  companyOverview: validGeneratedClientResearch.companyOverview,
  sizeFinancials: validGeneratedClientResearch.sizeFinancials,
  customersMarkets: validGeneratedClientResearch.customersMarkets,
  painPoints: validGeneratedClientResearch.painPoints,
  recentNews: validGeneratedClientResearch.recentNews,
  fitScore: validGeneratedClientResearch.fitScore,
  fitScoreRationale: validGeneratedClientResearch.fitScoreRationale,
  areasOfExpertise: validGeneratedClientResearch.areasOfExpertise ?? [],
  productsAndServices: [
    { name: 'Widget Pro', description: 'Industrial-grade widget platform' },
  ],
  keyStakeholders: [
    { name: 'Jane Doe', role: 'COO', linkedinUrl: 'https://www.linkedin.com/in/janedoe' },
  ],
  techStack: validGeneratedClientResearch.techStack ?? [],
  schemaVersion: 1,
  researchSources: [
    {
      title: 'Acme homepage',
      url: 'https://acme.example.com',
      retrievedAt: '2026-04-15T10:00:00.000Z',
    },
  ],
  researchedAt: '2026-04-15T10:00:00.000Z',
}

export const validResearchNoteResult: ResearchNoteResult = {
  schemaVersion: 1,
  summary: 'Acme Corp is a mid-size manufacturer with SAP-based operations.',
  findings: [
    { category: 'company', text: '500 employees', confidence: 'high' },
    { category: 'technical', text: 'Uses SAP S/4HANA', confidence: 'medium' },
  ],
  entitiesIdentified: [{ name: 'Jane Doe', type: 'person' }],
  followUpQuestions: ['What CRM does Acme use?'],
}

export const validSynthesisOutput: SynthesisOutput = {
  schemaVersion: 1,
  summary: 'Session confirmed the PO approval step and identified a new edge case.',
  graphPatch: {
    nodes: [
      {
        op: 'update',
        node: { id: 'n2', confidence: 'confirmed' },
      },
    ],
    edges: [],
    edgeCases: [
      {
        id: 'ec2',
        description: 'Rush PO bypasses finance',
        affectedNodeIds: ['n3'],
        frequency: 'rare',
        status: 'open',
      },
    ],
  },
  openQuestions: [{ text: 'What triggers a rush PO?', priority: 'important' }],
  confidenceAssessment: { overall: 'medium', notes: 'Single session source' },
}
