'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { EventType, SessionStatus } from '@/lib/db/schema'
import { getEventTypeConfig } from '@/lib/capture/event-types'
import { useEventSync } from '@/lib/hooks/use-event-sync'
import { useSuggestions } from '@/modules/ai/hooks/use-suggestions'
import { sessionsService } from '@/modules/sessions/services/sessions-service'
import { CaptureStatusBar } from '@/components/capture/capture-status-bar'
import { EventTypeBar } from '@/components/capture/event-type-bar'
import { ObservationInput } from '@/components/capture/observation-input'
import { SystemPicker } from '@/components/capture/system-picker'
import { SuggestionChips } from '@/components/capture/suggestion-chips'
import { EventLogPanel } from '@/components/capture/event-log-panel'
import { AnalyticsSidebar } from '@/components/capture/analytics-sidebar'
import { ConfirmEndDialog } from '@/components/capture/confirm-end-dialog'
import { TranscriptNotesEditor } from './transcript-notes-editor'
import { ReadOnlyEventLog } from './read-only-event-log'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Video, CheckCircle } from 'lucide-react'
import type { KeyedMutator } from 'swr'

type CaptureMode = 'idle' | 'capturing' | 'post-capture'

interface ShadowingCapturePanelProps {
  sessionId: string
  clientId: string
  processId: string
  sessionStatus: SessionStatus
  initialTranscript: string | null
  initialNotes: string | null
  mutateSession: KeyedMutator<any>
}

export function ShadowingCapturePanel({
  sessionId,
  clientId,
  processId,
  sessionStatus,
  initialTranscript,
  initialNotes,
  mutateSession,
}: ShadowingCapturePanelProps) {
  // Derive initial mode from session status
  // in_progress shows the review view — user clicks "Continue Logging" to re-enter capture
  const getInitialMode = (): CaptureMode => {
    if (
      sessionStatus === 'completed' ||
      sessionStatus === 'synthesis_done' ||
      sessionStatus === 'in_progress'
    )
      return 'post-capture'
    return 'idle'
  }

  const [mode, setMode] = useState<CaptureMode>(getInitialMode)
  const [selectedType, setSelectedType] = useState<EventType | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [systemPickerOpen, setSystemPickerOpen] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [startTime] = useState(() => Date.now())
  const endTimeRef = useRef<number>(0)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  const { events, addEvent, updateEventField, removeEvent, unsyncedCount, isOnline, flushAll } =
    useEventSync(sessionId)

  const {
    suggestions,
    isLoading: suggestionsLoading,
    fetchSuggestions,
    clearSuggestions,
  } = useSuggestions()

  // Fetch suggestions when type changes to STEP or EDGE
  useEffect(() => {
    if (mode !== 'capturing') return
    if (selectedType === 'STEP' || selectedType === 'EDGE') {
      fetchSuggestions(sessionId, selectedType, events.length)
    } else {
      clearSuggestions()
    }
  }, [selectedType, sessionId, events.length, fetchSuggestions, clearSuggestions, mode])

  const handleStartCapture = useCallback(async () => {
    setIsStarting(true)
    try {
      await sessionsService.update(sessionId, { status: 'in_progress' })
      mutateSession()
      setMode('capturing')
    } catch {
      toast.error('Failed to start capture session')
    } finally {
      setIsStarting(false)
    }
  }, [sessionId, mutateSession])

  function handleSelectType(type: EventType) {
    const config = getEventTypeConfig(type)
    if (config.behavior === 'instant_log') {
      addEvent(type, null, null, false)
      setSelectedType(null)
      setInputValue('')
      return
    }
    if (config.behavior === 'system_picker') {
      setSystemPickerOpen(true)
      setSelectedType(type)
      return
    }
    setSelectedType(type)
    setInputValue('')
  }

  function handleSubmitObservation() {
    if (!selectedType || !inputValue.trim()) return
    addEvent(selectedType, inputValue.trim(), null, false)
    setInputValue('')
    setSelectedType(null)
  }

  function handleSuggestionSelect(text: string) {
    if (!selectedType) return
    addEvent(selectedType, text, null, true)
    setInputValue('')
    setSelectedType(null)
  }

  function handleSystemSelect(systemName: string, detailNotes: string | null) {
    addEvent('SYSTEM', systemName, detailNotes, false)
    setSelectedType(null)
  }

  async function handleEndSession() {
    endTimeRef.current = Date.now()
    setIsEnding(true)
    try {
      await flushAll()
      setMode('post-capture')
    } catch {
      toast.error('Failed to sync events. Check your connection and try again.')
      endTimeRef.current = 0
    } finally {
      setIsEnding(false)
    }
  }

  const handleResumeCapture = useCallback(async () => {
    setIsResuming(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })
      if (!res.ok) throw new Error('Failed to resume session')
      mutateSession()
      setMode('capturing')
    } catch {
      toast.error('Failed to resume capture session')
    } finally {
      setIsResuming(false)
    }
  }, [sessionId, mutateSession])

  // === IDLE: "Start Capture" card ===
  if (mode === 'idle') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Video className="size-6 text-primary" />
          </div>
          <CardTitle>Shadowing Capture</CardTitle>
          <CardDescription>
            Start the capture session to log events in real time as you observe the process.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={handleStartCapture} disabled={isStarting} size="lg">
            {isStarting ? 'Starting...' : 'Start Capture'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // === POST-CAPTURE or COMPLETED: show event log + transcript/notes ===
  if (mode === 'post-capture') {
    const canResume = sessionStatus !== 'synthesis_done'
    const eventLogFooter = canResume ? (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Need to capture more events?</p>
        <Button variant="outline" size="sm" onClick={handleResumeCapture} disabled={isResuming}>
          <Video className="mr-1.5 size-4" />
          {isResuming ? 'Starting...' : 'Continue Logging'}
        </Button>
      </div>
    ) : null

    return (
      <div className="space-y-6">
        {/* Next step banner */}
        {(sessionStatus === 'in_progress' || sessionStatus === 'planned') && (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
            <CheckCircle className="size-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Ready to complete?</p>
              <p className="text-xs text-muted-foreground">
                Review your event log and add transcript/notes below, then mark as completed to
                unlock synthesis.
              </p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await sessionsService.update(sessionId, { status: 'completed' })
                  mutateSession()
                  toast.success('Session marked as completed')
                } catch {
                  toast.error('Failed to update session status')
                }
              }}
            >
              Mark as Completed
            </Button>
          </div>
        )}

        <ReadOnlyEventLog sessionId={sessionId} footer={eventLogFooter} />

        <TranscriptNotesEditor
          sessionId={sessionId}
          initialTranscript={initialTranscript}
          initialNotes={initialNotes}
          sessionStatus={sessionStatus}
          mutateSession={() => mutateSession()}
        />
      </div>
    )
  }

  // === CAPTURING: live capture UI ===
  return (
    <div className="space-y-4">
      <CaptureStatusBar
        startTime={startTime}
        isOnline={isOnline}
        unsyncedCount={unsyncedCount}
        eventCount={events.length}
        onEndSession={() => setShowConfirmDialog(true)}
      />

      <SystemPicker
        open={systemPickerOpen}
        onOpenChange={setSystemPickerOpen}
        onSelectSystem={handleSystemSelect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start min-w-0">
        <Card className="lg:col-span-3 min-h-[300px] flex flex-col min-w-0">
          <EventTypeBar selectedType={selectedType} onSelectType={handleSelectType} />

          <ObservationInput
            selectedType={selectedType}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmitObservation}
            onCancel={() => {
              setSelectedType(null)
              setInputValue('')
            }}
          />

          {(selectedType === 'STEP' || selectedType === 'EDGE') && (
            <SuggestionChips
              suggestions={suggestions}
              isLoading={suggestionsLoading}
              onSelectSuggestion={handleSuggestionSelect}
            />
          )}

          <EventLogPanel
            events={events}
            onUpdateEventField={updateEventField}
            onRemoveEvent={removeEvent}
          />
        </Card>
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Analytics</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AnalyticsSidebar events={events} />
          </CardContent>
        </Card>
      </div>

      <ConfirmEndDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        unsyncedCount={unsyncedCount}
        onConfirm={() => {
          setShowConfirmDialog(false)
          handleEndSession()
        }}
      />
    </div>
  )
}
