import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/clients'),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <div data-testid="user-button" />,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: vi.fn().mockReturnValue({
    user: {
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
    },
  }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <TooltipProvider>
      <SidebarProvider defaultOpen>{ui}</SidebarProvider>
    </TooltipProvider>
  );
}

describe('AppSidebar', () => {
  it('renders Clients and Settings links', () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights active route with data-active', () => {
    renderWithProviders(<AppSidebar />);
    const clientsButton = screen.getByText('Clients').closest('[data-slot="sidebar-menu-button"]');
    expect(clientsButton).toHaveAttribute('data-active');
  });

  it('renders UserButton', () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });
});
