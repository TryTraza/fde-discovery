'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useContacts } from '@/lib/hooks/use-contacts';
import { ContactFormDialog } from './contact-form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Mail, Phone, Trash2, Pencil } from 'lucide-react';

interface ContactsSectionProps {
  clientId: string;
  mutateClient: () => void;
}

export function ContactsSection({ clientId, mutateClient }: ContactsSectionProps) {
  const { contacts, isLoading, mutateContacts } = useContacts(clientId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onContactSaved = () => {
    mutateContacts();
    mutateClient();
  };

  const onDelete = async (contactId: string) => {
    setDeletingId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete contact');
        return;
      }
      mutateContacts();
      mutateClient();
      toast.success('Contact deleted');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Contacts</CardTitle>
          <ContactFormDialog clientId={clientId} onSaved={onContactSaved}>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 size-3.5" />
              Add
            </Button>
          </ContactFormDialog>
        </div>
      </CardHeader>
      <CardContent>
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
            {contacts.map((contact: any) => (
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
                    contact={contact}
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
      </CardContent>
    </Card>
  );
}
