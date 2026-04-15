import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfidenceLegend } from '@/modules/processes/components/confidence-legend'

describe('ConfidenceLegend', () => {
  it('renders Confirmed, Inferred, and Gap labels', () => {
    render(<ConfidenceLegend onAddStep={vi.fn()} />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Inferred')).toBeInTheDocument()
    expect(screen.getByText('Gap')).toBeInTheDocument()
  })

  it('renders colored indicators for each confidence level', () => {
    render(<ConfidenceLegend onAddStep={vi.fn()} />)
    const indicators = screen.getAllByTestId('confidence-indicator')
    expect(indicators).toHaveLength(3)
  })

  it('calls onAddStep when Add Step button clicked', () => {
    const onAddStep = vi.fn()
    render(<ConfidenceLegend onAddStep={onAddStep} />)
    fireEvent.click(screen.getByRole('button', { name: /add step/i }))
    expect(onAddStep).toHaveBeenCalledOnce()
  })
})
