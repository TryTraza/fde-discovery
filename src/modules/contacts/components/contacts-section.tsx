'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useContacts } from '@/modules/contacts/hooks/use-contacts'
import { ContactFormDialog } from './contact-form-dialog'
import { CollapsibleCard } from '@/components/shared/collapsible-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Mail, Phone, Trash2, Pencil } from 'lucide-react'
import { contactsService, type Contact } from '@/modules/contacts/services/contacts-service'
import { ApiError } from '@/lib/api-client'

interface ContactsSectionProps {
  clientId: string
  mutateClient: () => void
}

export function ContactsSection({ clientId, mutateClient }: ContactsSectionProps) {
  const { contacts, isLoading, mutateContacts } = useContacts(clientId)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function onContactSaved() {
    mutateContacts()
    mutateClient()
  }

  async function onDelete(contactId: string) {
    setDeletingId(contactId)
    try {
      await contactsService.delete(contactId)
      mutateContacts()
      mutateClient()
      toast.success('Contact deleted')
    } catch (error) {
      const message =
        error instanceof ApiError && typeof (error.body as { error?: string })?.error === 'string'
          ? (error.body as { error: string }).error
          : 'Failed to delete contact'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <CollapsibleCard
      title={
        <>
          Contacts
          {!isLoading && contacts.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({contacts.length})
            </span>
          )}
        </>
      }
      actions={
        <ContactFormDialog clientId={clientId} onSaved={onContactSaved}>
          <Button variant="outline" size="sm">
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        </ContactFormDialog>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact: Contact) => (
            <div
              key={contact.id}
              className="flex items-start justify-between rounded-md border p-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{contact.name}</p>
                {(contact.role || contact.department) && (
                  <p className="text-xs text-muted-foreground">
                    {[contact.role, contact.department].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <ContactFormDialog
                  clientId={clientId}
                  contact={{
                    id: contact.id,
                    name: contact.name,
                    role: contact.role ?? undefined,
                    department: contact.department ?? undefined,
                    email: contact.email ?? undefined,
                    phone: contact.phone ?? undefined,
                    notes: contact.notes ?? undefined,
                  }}
                  onSaved={onContactSaved}
                >
                  <Button variant="ghost" size="icon-sm">
                    <Pencil className="size-3.5" />
                  </Button>
                </ContactFormDialog>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(contact.id)}
                  disabled={deletingId === contact.id}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}
