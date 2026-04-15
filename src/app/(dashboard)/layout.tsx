import { cookies } from 'next/headers'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { BreadcrumbNav } from '@/components/layout/breadcrumb-nav'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SWRProvider } from '@/components/providers/swr-provider'
import { DashboardHeaderActions } from '@/components/layout/dashboard-header-actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <TooltipProvider>
      <SWRProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
              <SidebarTrigger className="md:hidden" />
              <BreadcrumbNav />
              <div className="ml-auto">
                <DashboardHeaderActions />
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </SWRProvider>
    </TooltipProvider>
  )
}
