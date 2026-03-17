import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuggestedNextSession } from '@/components/sessions/suggested-next-session';
import type { ProcessStepParsed } from '@/lib/validations/process';

function makeStep(overrides: Partial<ProcessStepParsed> = {}): ProcessStepParsed {
  return {
    id: `step-${Math.random()}`,
    name: 'Test Step',
    description: '',
    order: 1,
    confidence: 'confirmed',
    systems: [],
    edgeCases: [],
    notes: '',
    ...overrides,
  };
}

describe('SuggestedNextSession', () => {
  it('suggests Discovery when no completed sessions', () => {
    const steps = [makeStep()];
    render(<SuggestedNextSession steps={steps} sessions={[]} processStatus="draft" />);
    expect(screen.getByText(/Discovery/)).toBeInTheDocument();
  });

  it('suggests Shadowing when steps have gaps', () => {
    const steps = [
      makeStep({ name: 'Intake', confidence: 'confirmed' }),
      makeStep({ name: 'Review', confidence: 'missing' }),
    ];
    const sessions = [{ id: '1', status: 'completed' }];
    render(<SuggestedNextSession steps={steps} sessions={sessions} processStatus="mapping" />);
    expect(screen.getByText(/Shadowing/)).toBeInTheDocument();
  });

  it('suggests Process Mapping when more inferred than confirmed', () => {
    const steps = [
      makeStep({ confidence: 'confirmed' }),
      makeStep({ confidence: 'inferred' }),
      makeStep({ confidence: 'inferred' }),
    ];
    const sessions = [{ id: '1', status: 'completed' }];
    render(<SuggestedNextSession steps={steps} sessions={sessions} processStatus="mapping" />);
    expect(screen.getByText(/Process Mapping/)).toBeInTheDocument();
  });

  it('suggests Validation when all steps confirmed', () => {
    const steps = [
      makeStep({ confidence: 'confirmed' }),
      makeStep({ confidence: 'confirmed' }),
    ];
    const sessions = [{ id: '1', status: 'completed' }];
    render(<SuggestedNextSession steps={steps} sessions={sessions} processStatus="mapping" />);
    expect(screen.getByText(/Validation/)).toBeInTheDocument();
  });

  it('returns null when process is locked', () => {
    const steps = [makeStep()];
    const { container } = render(
      <SuggestedNextSession steps={steps} sessions={[]} processStatus="locked" />
    );
    expect(container.firstChild).toBeNull();
  });
});
