'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRole } from '@/lib/hooks/use-role'
import { toast } from 'sonner'
import { useClient } from '@/modules/clients/hooks/use-clients'
import { ClientDetailCard } from './client-detail-card'
import { AISummaryCard } from './ai-summary-card'
import { CompanyProfileCard } from './company-profile-card'
import { ContactsSection } from '@/modules/contacts/components/contacts-section'
import { ProcessesSection } from './processes-section'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { clientsService } from '@/modules/clients/services/clients-service'
import { ApiError } from '@/lib/api-client'

export function ClientOverview({ clientId }: { clientId: string }) {
  const { client, isLoading, error, mutateClient } = useClient(clientId)
  const { isAdmin } = useRole()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    setDeleting(true)
    try {
      await clientsService.delete(clientId)
      toast.success('Client deleted')
      router.push('/clients')
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to delete client'
      toast.error(message)
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[150px]" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Client not found.</p>
        <Link href="/clients" className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to clients
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{client.name}</h1>
        </div>
        {isAdmin && (
          <>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete client</DialogTitle>
                  <DialogDescription>
                    This will soft-delete <strong>{client.name}</strong> and all associated contacts
                    and processes. This action cannot be easily undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <Tabs defaultValue="overview" className="space-y-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ClientDetailCard client={client} clientId={clientId} mutateClient={mutateClient} />
          <ContactsSection clientId={clientId} mutateClient={mutateClient} />
        </TabsContent>

        <TabsContent value="intelligence" className="grid gap-6 lg:grid-cols-2">
          <CompanyProfileCard clientId={clientId} profile={client.profile ?? null} />
          <AISummaryCard client={client} clientId={clientId} mutateClient={mutateClient} />
        </TabsContent>

        <TabsContent value="processes">
          <ProcessesSection clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
