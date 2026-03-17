import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SessionsFeed } from '@/components/sessions/sessions-feed';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock CreateSessionDialog
vi.mock('@/components/sessions/create-session-dialog', () => ({
  CreateSessionDialog: () => null,
}));

// Mock SuggestedNextSession
vi.mock('@/components/sessions/suggested-next-session', () => ({
  SuggestedNextSession: () => <div data-testid="suggested-next-session" />,
}));

const mockSessions = [
  { id: '1', title: 'Discovery Interview', type: 'discovery', status: 'completed', date: '2026-03-10' },
  { id: '2', title: 'Process Mapping Session', type: 'process_mapping', status: 'in_progress', date: '2026-03-12' },
  { id: '3', title: 'Validation Call', type: 'validation', status: 'planned', date: '2026-03-15' },
];

describe('SessionsFeed', () => {
  const defaultProps = {
    clientId: 'c1',
    processId: 'p1',
    sessions: mockSessions,
    isLoading: false,
    error: undefined,
    mutateSessions: vi.fn(),
    steps: [],
    processStatus: 'mapping',
  };

  it('renders session rows with correct status dots', () => {
    render(<SessionsFeed {...defaultProps} />);
    const dots = screen.getAllByTestId('session-status-dot');
    expect(dots).toHaveLength(3);
  });

  it('renders session title and date', () => {
    render(<SessionsFeed {...defaultProps} />);
    expect(screen.getByText('Discovery Interview')).toBeInTheDocument();
    expect(screen.getByText('2026-03-10')).toBeInTheDocument();
  });

  it('renders empty state when no sessions', () => {
    render(<SessionsFeed {...defaultProps} sessions={[]} />);
    expect(screen.getByText(/no sessions/i)).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    render(<SessionsFeed {...defaultProps} isLoading={true} sessions={[]} />);
    const skeletons = screen.getAllByTestId('session-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders "New" button', () => {
    render(<SessionsFeed {...defaultProps} />);
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });

  it('renders SuggestedNextSession', () => {
    render(<SessionsFeed {...defaultProps} />);
    expect(screen.getByTestId('suggested-next-session')).toBeInTheDocument();
  });
});
