'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'
import { ResearchPanel } from '@/modules/research/components/research-panel'

export function DashboardHeaderActions() {
  const [researchOpen, setResearchOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setResearchOpen(true)} className="gap-2">
        <Brain className="h-4 w-4" />
        <span className="hidden sm:inline">Research</span>
      </Button>
      <ResearchPanel open={researchOpen} onOpenChange={setResearchOpen} />
    </>
  )
}
