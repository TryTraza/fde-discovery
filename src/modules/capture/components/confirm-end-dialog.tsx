'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmEndDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unsyncedCount: number
  onConfirm: () => void
}

export function ConfirmEndDialog({
  open,
  onOpenChange,
  unsyncedCount,
  onConfirm,
}: ConfirmEndDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop capture session?</AlertDialogTitle>
          <AlertDialogDescription>
            {unsyncedCount > 0
              ? `${unsyncedCount} pending event${unsyncedCount > 1 ? 's' : ''} will be synced. `
              : ''}
            You can add a transcript and notes afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Stop session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
