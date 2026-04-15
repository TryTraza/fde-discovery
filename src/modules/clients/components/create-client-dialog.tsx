'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { clientsService } from '@/modules/clients/services/clients-service'
import { ApiError } from '@/lib/api-client'
import type { ClientCreateInput } from '@/modules/clients/types'

interface CreateClientDialogProps {
  onCreated: () => void
  children: React.ReactNode
}

export function CreateClientDialog({ onCreated, children }: CreateClientDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ClientCreateInput>({
    name: '',
    industry: '',
    website: '',
    hqLocation: '',
    notes: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function resetForm() {
    setFormData({ name: '', industry: '', website: '', hqLocation: '', notes: '' })
    setFieldErrors({})
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setFieldErrors({})

    try {
      const payload: ClientCreateInput = {
        name: formData.name,
        industry: formData.industry,
      }
      if (formData.website) payload.website = formData.website
      if (formData.hqLocation) payload.hqLocation = formData.hqLocation
      if (formData.notes) payload.notes = formData.notes

      const created = await clientsService.create(payload)
      setOpen(false)
      resetForm()
      onCreated()
      toast.success('Client created')
      router.push(`/clients/${created.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; details?: Record<string, string[]> } | null
        if (body?.details) setFieldErrors(body.details)
        toast.error(body?.error || 'Failed to create client')
      } else {
        toast.error('Failed to create client')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
          <DialogDescription>Add a new client to start tracking.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              required
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => setFormData((d) => ({ ...d, industry: e.target.value }))}
              required
            />
            {fieldErrors.industry && (
              <p className="text-xs text-destructive">{fieldErrors.industry[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData((d) => ({ ...d, website: e.target.value }))}
            />
            {fieldErrors.website && (
              <p className="text-xs text-destructive">{fieldErrors.website[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hqLocation">HQ Location</Label>
            <Input
              id="hqLocation"
              placeholder="City, Country"
              value={formData.hqLocation}
              onChange={(e) => setFormData((d) => ({ ...d, hqLocation: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any relevant notes..."
              value={formData.notes}
              onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
