'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useResearchContext } from '@/modules/research/hooks/use-research-context'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Loader2, ArrowUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

const MIN_WIDTH = 320
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 380

interface ResearchPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResearchPanel({ open, onOpenChange }: ResearchPanelProps) {
  const { clientId, processId } = useResearchContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/research',
        body: { clientId, processId },
      }),
    [clientId, processId]
  )

  const { messages, sendMessage, status, setMessages, error } = useChat({ transport })
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return
    const delta = startX.current - e.clientX
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
    setWidth(next)
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function handleSubmitMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() || status === 'streaming') return
    sendMessage({ text: inputValue })
    setInputValue('')
  }

  function handleClear() {
    setMessages([])
  }

  const isApiKeyError = error?.message?.includes('422') || error?.message?.includes('No API key')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        style={{ width, maxWidth: 'none' }}
        className="p-0 flex flex-col transition-none"
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/20 transition-colors z-10"
        />

        <div className="flex items-center justify-between p-4 border-b">
          <SheetTitle className="flex items-center gap-2">AI Research</SheetTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {isApiKeyError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-medium text-amber-800">API Key Required</p>
                <p className="text-amber-700 mt-1">
                  Set your Anthropic API key in Settings to use AI Research.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Ask about the client, industry, process patterns...
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`${
                    message.role === 'user' ? 'ml-8 bg-primary/10 rounded-lg p-3' : 'mr-4'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {message.parts
                          ?.filter(
                            (part): part is { type: 'text'; text: string } => part.type === 'text'
                          )
                          .map((part) => part.text)
                          .join('') ?? ''}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">
                      {message.parts
                        ?.filter(
                          (part): part is { type: 'text'; text: string } => part.type === 'text'
                        )
                        .map((part) => part.text)
                        .join('') ?? ''}
                    </p>
                  )}
                </div>
              ))
            )}
            {status === 'streaming' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Researching...
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitMessage} className="p-3">
            <div className="relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a research question..."
                className="min-h-[64px] max-h-[120px] resize-none pr-12 py-3 bg-gray-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitMessage(e)
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 h-7 w-7 rounded-full"
                disabled={!inputValue.trim() || status === 'streaming'}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
