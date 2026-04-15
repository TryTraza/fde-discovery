import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QuestionSidebar } from '@/components/sessions/question-sidebar'

const MOCK_QUESTIONS = [
  { question: 'How does intake work?', rationale: 'r1', followUp: 'f1' },
  { question: 'Who approves requests?', rationale: 'r2', followUp: 'f2' },
  { question: 'What tools are used?', rationale: 'r3', followUp: 'f3' },
]

describe('QuestionSidebar', () => {
  it('shows only uncovered questions', () => {
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[true, false, false]}
        onToggleQuestion={vi.fn()}
        watchFor={[]}
      />
    )
    expect(screen.queryByText('How does intake work?')).not.toBeInTheDocument()
    expect(screen.getByText('Who approves requests?')).toBeInTheDocument()
    expect(screen.getByText('What tools are used?')).toBeInTheDocument()
  })

  it('shows remaining count', () => {
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[true, false, false]}
        onToggleQuestion={vi.fn()}
        watchFor={[]}
      />
    )
    expect(screen.getByText(/2 of 3 remaining/)).toBeInTheDocument()
  })

  it('shows "All questions covered" when all checked', () => {
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[true, true, true]}
        onToggleQuestion={vi.fn()}
        watchFor={[]}
      />
    )
    expect(screen.getByText(/All questions covered/)).toBeInTheDocument()
  })

  it('calls onToggleQuestion when check button clicked', () => {
    const toggle = vi.fn()
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[false, false, false]}
        onToggleQuestion={toggle}
        watchFor={[]}
      />
    )
    const checkButtons = screen.getAllByRole('button')
    fireEvent.click(checkButtons[0])
    expect(toggle).toHaveBeenCalledWith(0)
  })

  it('renders watch-for alerts', () => {
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        watchFor={['Beware of scope creep', 'Check for workarounds']}
      />
    )
    expect(screen.getByText('Beware of scope creep')).toBeInTheDocument()
    expect(screen.getByText('Check for workarounds')).toBeInTheDocument()
  })

  it('does not render alerts card when watchFor is empty', () => {
    render(
      <QuestionSidebar
        questions={MOCK_QUESTIONS}
        questionsAsked={[false, false, false]}
        onToggleQuestion={vi.fn()}
        watchFor={[]}
      />
    )
    expect(screen.queryByText(/Active alerts/i)).not.toBeInTheDocument()
  })
})
