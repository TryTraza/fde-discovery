'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_SYSTEM_OPTIONS } from '@/lib/capture/event-types';

interface SystemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSystem: (systemName: string, detailNotes: string | null) => void;
}

export function SystemPicker({ open, onOpenChange, onSelectSystem }: SystemPickerProps) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [detailNotes, setDetailNotes] = useState('');

  function handleSystemClick(system: string) {
    if (system === 'Other') {
      setSelectedSystem('Other');
      return;
    }
    setSelectedSystem(system);
  }

  function handleConfirm() {
    const systemName = selectedSystem === 'Other' ? customName.trim() : selectedSystem;
    if (!systemName) return;
    onSelectSystem(systemName, detailNotes.trim() || null);
    reset();
  }

  function reset() {
    setSelectedSystem(null);
    setCustomName('');
    setDetailNotes('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select system</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_SYSTEM_OPTIONS.map((system) => (
              <button
                key={system}
                onClick={() => handleSystemClick(system)}
                className={`
                  min-h-[48px] px-3 py-2 rounded-md border text-sm font-medium
                  transition-colors
                  ${selectedSystem === system
                    ? 'bg-violet-100 border-violet-600 text-violet-700'
                    : 'bg-background hover:bg-muted border-border'}
                `}
              >
                {system}
              </button>
            ))}
          </div>

          {selectedSystem === 'Other' && (
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="System name..."
              className="min-h-[48px]"
              autoFocus
            />
          )}

          {(selectedSystem && selectedSystem !== 'Other') || (selectedSystem === 'Other' && customName.trim()) ? (
            <>
              <Textarea
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                placeholder="Detail notes (optional): columns, sheets, fields..."
                className="min-h-[80px] text-sm"
              />
              <Button onClick={handleConfirm} className="w-full min-h-[48px]">
                Confirm
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
