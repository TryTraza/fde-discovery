'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Copy, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  researchService,
  type EmailDraftLanguage,
} from '@/modules/research/services/research-service'
import { ApiError, ApiKeyMissingError } from '@/lib/api-client'

interface EmailDraftCardProps {
  sessionId: string
}

export function EmailDraftCard({ sessionId }: EmailDraftCardProps) {
  const [email, setEmail] = useState<string | null>(null)
  const [language, setLanguage] = useState<EmailDraftLanguage>('en')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setIsLoading(true)
    try {
      const { email } = await researchService.generateEmailDraft(sessionId, language)
      setEmail(email)
    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        toast.error('Set your Anthropic API key in Settings to use AI features.')
      } else if (error instanceof ApiError) {
        const body = error.body as { error?: string } | null
        toast.error(body?.error || 'Failed to generate email')
      } else {
        toast.error('Network error. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopy() {
    if (!email) return
    await navigator.clipboard.writeText(email)
    setCopied(true)
    toast.success('Email copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Follow-Up Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1">
          <Button
            variant={language === 'en' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('en')}
          >
            EN
          </Button>
          <Button
            variant={language === 'es' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLanguage('es')}
          >
            ES
          </Button>
        </div>

        {email ? (
          <>
            <textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[200px] rounded-md border px-3 py-2 text-sm resize-y"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={isLoading}
              >
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleGenerate} disabled={isLoading} size="sm">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              'Generate Follow-Up Email'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
