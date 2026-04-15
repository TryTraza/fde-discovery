import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrepBriefPanel } from '@/components/sessions/prep-brief-panel'

// Mock clerk
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { publicMetadata: { role: 'admin' } } }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const MOCK_PREP_BRIEF = {
  summary: 'This session should focus on understanding the intake process.',
  questionsToAsk: [
    {
      question: 'How does intake work?',
      rationale: 'Need to understand entry',
      followUp: 'What triggers it?',
    },
    {
      question: 'Who approves requests?',
      rationale: 'Understand authority',
      followUp: 'Is there a backup?',
    },
    {
      question: 'What tools are used?',
      rationale: 'Map the tech stack',
      followUp: 'Any workarounds?',
    },
  ],
  approaches: [
    { title: 'Walk the process', description: 'Ask them to walk through a recent example' },
    { title: 'Follow the document', description: 'Trace each document through the process' },
  ],
  areasToProbe: [
    'Handoff between intake and processing',
    'Error handling procedures',
    'Volume patterns and peaks',
    'Staff training approach',
    'Documentation quality',
  ],
  watchFor: ['Scope creep into unrelated processes', 'Workarounds that mask real issues'],
}

const MOCK_INTERVIEW_ANSWERS = [
  { question: 'What is the main goal?', answer: 'Understand intake flow' },
  { question: 'Who will attend?', answer: 'Operations manager' },
]

describe('PrepBriefPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Empty state
  it('renders generate button when no prepBrief', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={null}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText('No prep brief yet')).toBeInTheDocument()
    expect(screen.getByText('Generate Prep Brief')).toBeInTheDocument()
  })

  // Context strip
  it('renders context strip with session type when interviewAnswers exist', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={MOCK_INTERVIEW_ANSWERS}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText(/Discovery/)).toBeInTheDocument()
    expect(screen.getByText(/Understand intake flow/)).toBeInTheDocument()
  })

  it('does not render context strip when no interviewAnswers', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={undefined}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.queryByText('Show context')).not.toBeInTheDocument()
  })

  it('expands full context on "Show context" click', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={MOCK_INTERVIEW_ANSWERS}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    const toggle = screen.getByText('Show context')
    fireEvent.click(toggle)
    expect(screen.getByText('What is the main goal?')).toBeInTheDocument()
    expect(screen.getByText('Who will attend?')).toBeInTheDocument()
  })

  // Progress bar
  it('renders progress bar with correct counts', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[true, false, true]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText(/2 of 3 questions covered/)).toBeInTheDocument()
  })

  // Questions checklist
  it('renders all questions with numbers', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText('How does intake work?')).toBeInTheDocument()
    expect(screen.getByText('Who approves requests?')).toBeInTheDocument()
    expect(screen.getByText('What tools are used?')).toBeInTheDocument()
  })

  it('applies line-through to checked questions', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[true, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    const checkedText = screen.getByText('How does intake work?')
    expect(checkedText.className).toContain('line-through')
  })

  it('calls onToggleQuestion when check circle clicked', () => {
    const toggle = vi.fn()
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={toggle}
        sessionType="discovery"
      />
    )
    // Find check buttons within the questions card
    const checkButtons = screen.getAllByRole('button', { name: /toggle question/i })
    fireEvent.click(checkButtons[1])
    expect(toggle).toHaveBeenCalledWith(1)
  })

  // Approaches
  it('renders approach titles as pills', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText('Walk the process')).toBeInTheDocument()
    expect(screen.getByText('Follow the document')).toBeInTheDocument()
  })

  it('shows approach description when pill clicked', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    fireEvent.click(screen.getByText('Walk the process'))
    expect(screen.getByText('Ask them to walk through a recent example')).toBeInTheDocument()
  })

  // Areas to probe
  it('shows first 4 areas with "Show more" toggle', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText('Handoff between intake and processing')).toBeInTheDocument()
    expect(screen.getByText('Error handling procedures')).toBeInTheDocument()
    expect(screen.getByText('Volume patterns and peaks')).toBeInTheDocument()
    expect(screen.getByText('Staff training approach')).toBeInTheDocument()
    expect(screen.queryByText('Documentation quality')).not.toBeInTheDocument()
    expect(screen.getByText('Show 1 more')).toBeInTheDocument()
  })

  it('shows all areas after toggle click', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    fireEvent.click(screen.getByText('Show 1 more'))
    expect(screen.getByText('Documentation quality')).toBeInTheDocument()
  })

  // Watch for
  it('renders all watch-for items (never collapsed)', () => {
    render(
      <PrepBriefPanel
        sessionId="s1"
        prepBrief={MOCK_PREP_BRIEF}
        mutateSession={vi.fn()}
        interviewAnswers={[]}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        sessionType="discovery"
      />
    )
    expect(screen.getByText('Scope creep into unrelated processes')).toBeInTheDocument()
    expect(screen.getByText('Workarounds that mask real issues')).toBeInTheDocument()
  })
})
