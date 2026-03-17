import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditDetailsSheet } from '@/components/processes/edit-details-sheet';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockProcess = {
  id: 'proc-1',
  name: 'Invoice Processing',
  status: 'draft',
  departmentTag: 'Finance',
  description: 'Handles invoices',
  processTypeL1: 'invoice_processing',
};

describe('EditDetailsSheet', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('renders all form fields with process values when open', () => {
    render(
      <EditDetailsSheet
        open={true}
        onOpenChange={vi.fn()}
        process={mockProcess}
        clientId="c1"
        mutateProcess={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Invoice Processing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Finance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Handles invoices')).toBeInTheDocument();
  });

  it('renders process type as read-only', () => {
    render(
      <EditDetailsSheet
        open={true}
        onOpenChange={vi.fn()}
        process={mockProcess}
        clientId="c1"
        mutateProcess={vi.fn()}
      />
    );
    expect(screen.getByText('invoice_processing')).toBeInTheDocument();
  });

  it('calls PATCH with correct field on name blur', async () => {
    const mutateProcess = vi.fn();
    render(
      <EditDetailsSheet
        open={true}
        onOpenChange={vi.fn()}
        process={mockProcess}
        clientId="c1"
        mutateProcess={mutateProcess}
      />
    );

    const nameInput = screen.getByDisplayValue('Invoice Processing');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/clients/c1/processes/proc-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated Name' }),
        })
      );
    });
  });

  it('renders status select with valid transitions', () => {
    render(
      <EditDetailsSheet
        open={true}
        onOpenChange={vi.fn()}
        process={mockProcess}
        clientId="c1"
        mutateProcess={vi.fn()}
      />
    );
    // Draft status badge should be shown
    const badges = screen.getAllByText('draft');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render when closed', () => {
    const { container } = render(
      <EditDetailsSheet
        open={false}
        onOpenChange={vi.fn()}
        process={mockProcess}
        clientId="c1"
        mutateProcess={vi.fn()}
      />
    );
    expect(screen.queryByDisplayValue('Invoice Processing')).not.toBeInTheDocument();
  });
});
