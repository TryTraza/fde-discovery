import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MetadataStrip } from '@/components/processes/metadata-strip'

const mockProcess = {
  departmentTag: 'Finance',
  processTypeL1: 'invoice_processing',
  processModel: {
    steps: [
      {
        id: '1',
        name: 'Step 1',
        description: '',
        order: 1,
        confidence: 'confirmed',
        systems: [],
        edgeCases: [],
        notes: '',
      },
      {
        id: '2',
        name: 'Step 2',
        description: '',
        order: 2,
        confidence: 'inferred',
        systems: [],
        edgeCases: [],
        notes: '',
      },
      {
        id: '3',
        name: 'Step 3',
        description: '',
        order: 3,
        confidence: 'missing',
        systems: [],
        edgeCases: [],
        notes: '',
      },
    ],
  },
}

describe('MetadataStrip', () => {
  it('renders department tag', () => {
    render(
      <MetadataStrip
        process={mockProcess}
        sessionCount={3}
        completedSessionCount={1}
        onEditClick={vi.fn()}
      />
    )
    expect(screen.getByText('Finance')).toBeInTheDocument()
  })

  it('renders "—" when no department', () => {
    render(
      <MetadataStrip
        process={{ ...mockProcess, departmentTag: null }}
        sessionCount={0}
        completedSessionCount={0}
        onEditClick={vi.fn()}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders process type', () => {
    render(
      <MetadataStrip
        process={mockProcess}
        sessionCount={0}
        completedSessionCount={0}
        onEditClick={vi.fn()}
      />
    )
    expect(screen.getByText('invoice_processing')).toBeInTheDocument()
  })

  it('renders step confidence counts', () => {
    render(
      <MetadataStrip
        process={mockProcess}
        sessionCount={0}
        completedSessionCount={0}
        onEditClick={vi.fn()}
      />
    )
    // Should show total steps and breakdown
    expect(screen.getByText('3 steps')).toBeInTheDocument()
  })

  it('renders session counts', () => {
    render(
      <MetadataStrip
        process={mockProcess}
        sessionCount={5}
        completedSessionCount={2}
        onEditClick={vi.fn()}
      />
    )
    expect(screen.getByText(/2.*\/.*5/)).toBeInTheDocument()
  })

  it('calls onEditClick when Edit details clicked', () => {
    const onEditClick = vi.fn()
    render(
      <MetadataStrip
        process={mockProcess}
        sessionCount={0}
        completedSessionCount={0}
        onEditClick={onEditClick}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /edit details/i }))
    expect(onEditClick).toHaveBeenCalledOnce()
  })
})
