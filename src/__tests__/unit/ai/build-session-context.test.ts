import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/queries/sessions', () => ({
  getSessionById: vi.fn(),
  listSessionContacts: vi.fn(),
  getCompletedSessionsByProcess: vi.fn(),
}));

vi.mock('@/lib/db/queries/processes', () => ({
  getProcessWithModel: vi.fn(),
}));

vi.mock('@/lib/db/queries/clients', () => ({
  getClientById: vi.fn(),
}));

import { buildSessionContext } from '@/lib/ai/context';
import { getSessionById, listSessionContacts, getCompletedSessionsByProcess } from '@/lib/db/queries/sessions';
import { getProcessWithModel } from '@/lib/db/queries/processes';
import { getClientById } from '@/lib/db/queries/clients';

const fakeClient = {
  id: 'c1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  website: 'https://acme.com',
  status: 'active_poc',
  aiSummary: 'Acme is a large manufacturer.',
  notes: 'Good relationship with VP of Ops.',
};

const fakeProcess = {
  id: 'p1',
  clientId: 'c1',
  name: 'Purchasing',
  description: 'How things are purchased',
  status: 'mapping',
  hypothesisText: 'Likely 3-step approval',
  departmentTag: 'Finance',
  processTypeL1: 'procurement',
  processModel: {
    steps: [{ id: 's1', name: 'Request', order: 1 }],
    systems: [{ name: 'SAP', confirmed: true }],
    edgeCases: [],
  },
  openQuestions: [],
};

const fakeSession = {
  id: 'ses1',
  processId: 'p1',
  type: 'discovery',
  title: 'Kickoff',
  date: '2026-03-15',
  status: 'planned',
  interviewAnswers: { questions: [{ question: 'What is the goal?', answer: 'Map the flow' }] },
  transcriptText: 'Full transcript...',
  notes: 'FDE notes...',
};

const fakeContacts = [
  { id: 'ct1', name: 'Jane Doe', role: 'VP Operations', department: 'Operations' },
  { id: 'ct2', name: 'John Smith', role: 'Buyer', department: 'Procurement' },
];

const fakePriorSession = {
  id: 'ses0',
  processId: 'p1',
  type: 'discovery',
  title: 'Previous Discovery',
  date: '2026-03-01',
  status: 'synthesis_done',
  interviewAnswers: { questions: [{ question: 'Q1', answer: 'A1' }] },
  synthesisOutput: { summary: 'Found 3 steps with manual approval bottleneck' },
  transcriptText: 'Prior transcript...',
  notes: 'Prior notes...',
};

describe('buildSessionContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full L1+L2+L3 context chain', async () => {
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(listSessionContacts).mockResolvedValue(fakeContacts as any);
    vi.mocked(getCompletedSessionsByProcess).mockResolvedValue([fakePriorSession as any]);

    const ctx = await buildSessionContext('ses1');

    // L2: Client
    expect(ctx.client.name).toBe('Acme Corp');
    expect(ctx.client.industry).toBe('Manufacturing');
    expect(ctx.client.website).toBe('https://acme.com');
    expect(ctx.client.aiSummary).toBe('Acme is a large manufacturer.');

    // L2: Process
    expect(ctx.process.name).toBe('Purchasing');
    expect(ctx.process.description).toBe('How things are purchased');
    expect(ctx.process.hypothesisText).toBe('Likely 3-step approval');
    expect(ctx.process.model).toBeTruthy();
    expect(ctx.process.model!.steps).toHaveLength(1);

    // L3: Current session
    expect(ctx.session.title).toBe('Kickoff');
    expect(ctx.session.type).toBe('discovery');
    expect(ctx.session.interviewAnswers).toBeTruthy();

    // L3: Session participants
    expect(ctx.sessionContacts).toHaveLength(2);
    expect(ctx.sessionContacts[0].name).toBe('Jane Doe');
    expect(ctx.sessionContacts[0].role).toBe('VP Operations');

    // L3: Prior sessions (excludes current)
    expect(ctx.priorSessions).toHaveLength(1);
    expect(ctx.priorSessions[0].title).toBe('Previous Discovery');
    expect(ctx.priorSessions[0].synthesisOutput).toBeTruthy();
  });

  it('excludes current session from prior sessions', async () => {
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(listSessionContacts).mockResolvedValue([]);
    // Include the current session in completed list — should be filtered
    vi.mocked(getCompletedSessionsByProcess).mockResolvedValue([
      fakeSession as any,
      fakePriorSession as any,
    ]);

    const ctx = await buildSessionContext('ses1');
    expect(ctx.priorSessions).toHaveLength(1);
    expect(ctx.priorSessions[0].id).toBe('ses0');
  });

  it('throws when session not found', async () => {
    vi.mocked(getSessionById).mockResolvedValue(null as any);
    await expect(buildSessionContext('missing')).rejects.toThrow('Session not found');
  });

  it('throws when process not found', async () => {
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
    vi.mocked(getProcessWithModel).mockResolvedValue(null as any);
    await expect(buildSessionContext('ses1')).rejects.toThrow('Process not found');
  });

  it('throws when client not found', async () => {
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(null as any);
    await expect(buildSessionContext('ses1')).rejects.toThrow('Client not found');
  });

  it('works with empty contacts and no prior sessions', async () => {
    vi.mocked(getSessionById).mockResolvedValue(fakeSession as any);
    vi.mocked(getProcessWithModel).mockResolvedValue(fakeProcess as any);
    vi.mocked(getClientById).mockResolvedValue(fakeClient as any);
    vi.mocked(listSessionContacts).mockResolvedValue([]);
    vi.mocked(getCompletedSessionsByProcess).mockResolvedValue([]);

    const ctx = await buildSessionContext('ses1');
    expect(ctx.sessionContacts).toEqual([]);
    expect(ctx.priorSessions).toEqual([]);
  });
});
