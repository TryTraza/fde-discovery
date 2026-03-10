'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ContactFormData {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: ContactFormData = {
  name: '',
  role: '',
  department: '',
  email: '',
  phone: '',
  notes: '',
};

interface ContactFormDialogProps {
  clientId: string;
  contact?: { id: string } & Partial<ContactFormData>;
  onSaved: () => void;
  children: React.ReactNode;
}

export function ContactFormDialog({ clientId, contact, onSaved, children }: ContactFormDialogProps) {
  const isEdit = !!contact;
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const resetForm = () => {
    if (contact) {
      setFormData({
        name: contact.name ?? '',
        role: contact.role ?? '',
        department: contact.department ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        notes: contact.notes ?? '',
      });
    } else {
      setFormData(emptyForm);
    }
    setFieldErrors({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const body: Record<string, string> = { name: formData.name };
      if (formData.role) body.role = formData.role;
      if (formData.department) body.department = formData.department;
      if (formData.email) body.email = formData.email;
      if (formData.phone) body.phone = formData.phone;
      if (formData.notes) body.notes = formData.notes;

      const url = isEdit
        ? `/api/contacts/${contact!.id}`
        : `/api/clients/${clientId}/contacts`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.details) setFieldErrors(err.details);
        toast.error(err.error || `Failed to ${isEdit ? 'update' : 'create'} contact`);
        return;
      }

      setOpen(false);
      onSaved();
      toast.success(isEdit ? 'Contact updated' : 'Contact added');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) resetForm();
      }}
    >
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              required
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-role">Role</Label>
              <Input
                id="contact-role"
                placeholder="e.g. VP Sales"
                value={formData.role}
                onChange={(e) => setFormData((d) => ({ ...d, role: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-dept">Department</Label>
              <Input
                id="contact-dept"
                placeholder="e.g. Operations"
                value={formData.department}
                onChange={(e) => setFormData((d) => ({ ...d, department: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={formData.phone}
                onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              value={formData.notes}
              onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
