'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Pencil, Info, Plus, Trash2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useAIAgents, useRegistries } from '@/modules/ai/hooks/use-ai-agents'
import { useSkills } from '@/modules/ai/hooks/use-skills'

// ── Constants ──

const MODE_OPTIONS = [
  {
    value: 'generateObject',
    label: 'Structured Output',
    description: 'Returns JSON matching a schema',
  },
  { value: 'generateText', label: 'Text', description: 'Returns plain text' },
  { value: 'streamText', label: 'Streaming', description: 'Streams tokens in real-time' },
]

const MODEL_OPTIONS = [
  { value: 'fast', label: 'Fast (Haiku)', description: 'Cheaper, faster' },
  { value: 'standard', label: 'Standard (Sonnet)', description: 'More capable' },
]

// ── Scope: derived from which layers an agent uses ──

type Scope = 'session' | 'process' | 'client' | 'domain' | 'global'

const SCOPE_INFO: Record<
  Scope,
  { label: string; description: string; icon: string; color: string }
> = {
  session: {
    label: 'Session-scoped',
    description: 'Operates within a specific session — has access to transcript, events, debrief',
    icon: '🎯',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  process: {
    label: 'Process-scoped',
    description: 'Operates on a specific process — has access to process model and hypothesis',
    icon: '⚙️',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  client: {
    label: 'Client-scoped',
    description: 'Operates at client level — has access to client data only',
    icon: '🏢',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  domain: {
    label: 'Domain-scoped',
    description: 'Uses only domain templates (no client/process context)',
    icon: '📚',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  global: {
    label: 'Global',
    description: 'Has no configured layers — all context provided by the caller',
    icon: '🌐',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

const SCOPE_ORDER: Scope[] = ['global', 'domain', 'client', 'process', 'session']

function deriveScope(layers: Array<{ layer: string }> = []): Scope {
  const layerNames = new Set(layers.map((l) => l.layer))
  if (layerNames.has('l4-session')) return 'session'
  if (layerNames.has('l3-process')) return 'process'
  if (layerNames.has('l2-client')) return 'client'
  if (layerNames.has('l1-domain')) return 'domain'
  return 'global'
}

const LAYER_BADGE_INFO: Record<string, { short: string; color: string; title: string }> = {
  'l1-domain': {
    short: 'L1',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    title: 'Domain Library',
  },
  'l2-client': {
    short: 'L2',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    title: 'Client Data',
  },
  'l3-process': {
    short: 'L3',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    title: 'Process & Model',
  },
  'l4-session': {
    short: 'L4',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    title: 'Session Data',
  },
}

const LAYER_OPTIONS = [
  {
    value: 'l1-domain',
    label: 'Domain Library',
    description:
      'Industry-specific process templates (e.g. procurement steps, common systems). Helps the AI understand typical patterns for this type of process.',
  },
  {
    value: 'l2-client',
    label: 'Client Data',
    description:
      'Client name, industry, website, AI research summary. Gives the AI company-specific context to personalize its output.',
  },
  {
    value: 'l3-process',
    label: 'Process & Model',
    description:
      'Process name, description, hypothesis, and the current process model (steps, systems, edge cases). Essential for any process-aware AI call.',
  },
  {
    value: 'l4-session',
    label: 'Session Data',
    description:
      'Session transcript, notes, events, contacts, prior sessions, debrief answers. Required for synthesis and session-specific features.',
  },
]

const L1_MODE_OPTIONS = [
  {
    value: 'matched',
    label: 'Matched',
    description: 'Only the domain matching the current process type',
  },
  {
    value: 'all',
    label: 'All',
    description: 'Every domain template (used for hypothesis generation)',
  },
]

const L2_FIELDS = [
  { value: 'full', label: 'Full', description: 'All client fields with formatted summary block' },
  { value: 'summary', label: 'Summary', description: 'Name, industry, and website only' },
]

const L3_FIELDS = [
  { value: 'full', label: 'Full', description: 'All process fields with formatted summary block' },
  { value: 'summary', label: 'Summary', description: 'Name, description, and department only' },
]

const L4_EVENTS = [
  { value: 'all', label: 'All events', description: 'Full chronological event log' },
  {
    value: 'last20',
    label: 'Last 20 events',
    description: 'Recent events — ideal for real-time suggestions',
  },
  {
    value: 'none',
    label: 'No events',
    description: "Skip events — agent doesn't need the event log",
  },
]

// ── Helpers ──

function modeLabel(mode: string) {
  return MODE_OPTIONS.find((m) => m.value === mode)?.label ?? mode
}
function modelLabel(model: string) {
  return MODEL_OPTIONS.find((m) => m.value === model)?.label ?? model
}

function SelectOptionItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground leading-snug whitespace-normal">
        {description}
      </span>
    </div>
  )
}

function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="inline ml-1 align-middle cursor-help">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Layer Config Types ──

interface LayerConfig {
  layer: string
  options: Record<string, unknown>
}

function defaultOptionsForLayer(layer: string): Record<string, unknown> {
  switch (layer) {
    case 'l1-domain':
      return { mode: 'matched' }
    case 'l2-client':
      return { fields: 'full' }
    case 'l3-process':
      return { includeModel: true, fields: 'full' }
    case 'l4-session':
      return { events: 'none', contacts: false, priorSessions: false, debrief: false }
    default:
      return {}
  }
}

// ── Form State ──

interface AgentFormState {
  label: string
  description: string
  mode: string
  model: string
  langfusePromptName: string
  schemaSlug: string
  maxOutputTokens: number
  layers: LayerConfig[]
  selectedTools: string[]
  toolOptions: Record<string, Record<string, unknown>>
  selectedSkills: string[]
  layerTimeout: number
  totalTimeout: number
  fallbackOnLayerError: boolean
  enabled: boolean
}

function parseForm(agent: any): AgentFormState {
  const tools = (agent.tools ?? []) as Array<{ tool: string; options?: Record<string, unknown> }>
  const toolOptions: Record<string, Record<string, unknown>> = {}
  for (const t of tools) {
    if (t.options) toolOptions[t.tool] = t.options
  }
  const resilience = (agent.resilience ?? {}) as any
  const rawLayers = (agent.layers ?? []) as Array<{
    layer: string
    options?: Record<string, unknown>
  }>

  return {
    label: agent.label ?? '',
    description: agent.description ?? '',
    mode: agent.mode ?? 'generateText',
    model: agent.model ?? 'standard',
    langfusePromptName: agent.langfusePromptName ?? '',
    schemaSlug: agent.schemaSlug ?? '',
    maxOutputTokens: agent.maxOutputTokens ?? 1000,
    layers: rawLayers.map((l) => ({
      layer: l.layer,
      options: l.options ?? defaultOptionsForLayer(l.layer),
    })),
    selectedTools: tools.map((t) => t.tool),
    toolOptions,
    selectedSkills: (agent.skills ?? []) as string[],
    layerTimeout: resilience.layerTimeout ?? 5000,
    totalTimeout: resilience.totalTimeout ?? 15000,
    fallbackOnLayerError: resilience.fallbackOnLayerError ?? true,
    enabled: agent.enabled ?? true,
  }
}

// ── Layer Options Editor ──

function LayerOptionsEditor({
  layer,
  options,
  onChange,
}: {
  layer: string
  options: Record<string, unknown>
  onChange: (opts: Record<string, unknown>) => void
}) {
  const set = (key: string, value: unknown) => onChange({ ...options, [key]: value })

  switch (layer) {
    case 'l1-domain': {
      const current = L1_MODE_OPTIONS.find((o) => o.value === options.mode) ?? L1_MODE_OPTIONS[0]
      return (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Domain mode:</span>
          <Select value={current.value} onValueChange={(v) => v && set('mode', v)}>
            <SelectTrigger>
              <SelectValue>{current.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[380px]">
              {L1_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <SelectOptionItem label={o.label} description={o.description} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    case 'l2-client': {
      const current = L2_FIELDS.find((o) => o.value === options.fields) ?? L2_FIELDS[0]
      return (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Fields to include:</span>
          <Select value={current.value} onValueChange={(v) => v && set('fields', v)}>
            <SelectTrigger>
              <SelectValue>{current.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[380px]">
              {L2_FIELDS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <SelectOptionItem label={o.label} description={o.description} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    case 'l3-process': {
      const current = L3_FIELDS.find((o) => o.value === options.fields) ?? L3_FIELDS[0]
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={!!options.includeModel}
              onCheckedChange={(c) => set('includeModel', !!c)}
            />
            <span className="text-xs">Include process model (steps, systems, edge cases)</span>
          </label>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Fields to include:</span>
            <Select value={current.value} onValueChange={(v) => v && set('fields', v)}>
              <SelectTrigger>
                <SelectValue>{current.label}</SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[380px]">
                {L3_FIELDS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <SelectOptionItem label={o.label} description={o.description} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }

    case 'l4-session': {
      const current = L4_EVENTS.find((o) => o.value === options.events) ?? L4_EVENTS[2]
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Capture events to include:</span>
            <Select value={current.value} onValueChange={(v) => v && set('events', v)}>
              <SelectTrigger>
                <SelectValue>{current.label}</SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[380px]">
                {L4_EVENTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <SelectOptionItem label={o.label} description={o.description} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={!!options.contacts}
                onCheckedChange={(c) => set('contacts', !!c)}
              />
              Contacts
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={!!options.priorSessions}
                onCheckedChange={(c) => set('priorSessions', !!c)}
              />
              Prior sessions
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={!!options.debrief} onCheckedChange={(c) => set('debrief', !!c)} />
              Debrief answers
            </label>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

// ── Main Page ──

export default function AIAgentsPage() {
  const { agents, isLoading, mutateAgents } = useAIAgents()
  const { data: registries } = useRegistries()
  const { skills: availableSkills } = useSkills()
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [form, setForm] = useState<AgentFormState | null>(null)
  const [saving, setSaving] = useState(false)

  const openEdit = (agent: any) => {
    setEditingSlug(agent.slug)
    setForm(parseForm(agent))
  }

  const handleSave = async () => {
    if (!editingSlug || !form) return
    setSaving(true)
    try {
      const tools = form.selectedTools.map((slug) => ({
        tool: slug,
        ...(form.toolOptions[slug] ? { options: form.toolOptions[slug] } : {}),
      }))

      const layers = form.layers.map((l) => ({
        layer: l.layer,
        ...(Object.keys(l.options).length > 0 ? { options: l.options } : {}),
      }))

      const res = await fetch(`/api/settings/ai-agents/${editingSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          description: form.description || null,
          mode: form.mode,
          model: form.model,
          langfusePromptName: form.langfusePromptName,
          schemaSlug: form.mode === 'generateObject' ? form.schemaSlug || null : null,
          tools,
          layers,
          skills: form.selectedSkills,
          resilience: {
            layerTimeout: form.layerTimeout,
            totalTimeout: form.totalTimeout,
            fallbackOnLayerError: form.fallbackOnLayerError,
          },
          maxOutputTokens: form.maxOutputTokens,
          enabled: form.enabled,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update agent')
      }
      toast.success('Agent updated')
      mutateAgents()
      setEditingSlug(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (slug: string, enabled: boolean) => {
    const res = await fetch(`/api/settings/ai-agents/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) mutateAgents()
    else toast.error('Failed to toggle agent')
  }

  // Layer management
  const addLayer = (layerName: string) => {
    if (!form) return
    if (form.layers.some((l) => l.layer === layerName)) return
    setForm({
      ...form,
      layers: [...form.layers, { layer: layerName, options: defaultOptionsForLayer(layerName) }],
    })
  }
  const removeLayer = (index: number) => {
    if (!form) return
    setForm({ ...form, layers: form.layers.filter((_, i) => i !== index) })
  }
  const updateLayerOptions = (index: number, options: Record<string, unknown>) => {
    if (!form) return
    const layers = [...form.layers]
    layers[index] = { ...layers[index], options }
    setForm({ ...form, layers })
  }

  const toggleTool = (slug: string) => {
    if (!form) return
    const selected = form.selectedTools.includes(slug)
      ? form.selectedTools.filter((s) => s !== slug)
      : [...form.selectedTools, slug]
    setForm({ ...form, selectedTools: selected })
  }

  const toggleSkill = (slug: string) => {
    if (!form) return
    const selected = form.selectedSkills.includes(slug)
      ? form.selectedSkills.filter((s) => s !== slug)
      : [...form.selectedSkills, slug]
    setForm({ ...form, selectedSkills: selected })
  }

  const updateToolOption = (toolSlug: string, key: string, value: unknown) => {
    if (!form) return
    setForm({
      ...form,
      toolOptions: {
        ...form.toolOptions,
        [toolSlug]: { ...(form.toolOptions[toolSlug] ?? {}), [key]: value },
      },
    })
  }

  const availableLayersToAdd = form
    ? LAYER_OPTIONS.filter((lo) => !form.layers.some((l) => l.layer === lo.value))
    : []

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Configure how each AI feature works: model, context, tools, and prompts.
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : !agents?.length ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No agents configured. Run the seed script first.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {SCOPE_ORDER.map((scope) => {
              const scopeAgents = agents.filter((a: any) => deriveScope(a.layers ?? []) === scope)
              if (scopeAgents.length === 0) return null
              const info = SCOPE_INFO[scope]

              return (
                <div key={scope} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${info.color}`}
                    >
                      <span>{info.icon}</span>
                      <span>{info.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{info.description}</span>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[38%]">Agent</TableHead>
                            <TableHead className="w-[120px]">Layers</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead className="w-[60px]">On</TableHead>
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scopeAgents.map((agent: any) => {
                            const layers = (agent.layers ?? []) as Array<{ layer: string }>
                            return (
                              <TableRow
                                key={agent.slug}
                                className="cursor-pointer"
                                onClick={() => openEdit(agent)}
                              >
                                <TableCell>
                                  <span className="font-medium text-sm">{agent.label}</span>
                                  {agent.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[320px]">
                                      {agent.description}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {layers.length === 0 ? (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    ) : (
                                      layers.map((l) => {
                                        const info = LAYER_BADGE_INFO[l.layer]
                                        if (!info) return null
                                        return (
                                          <Tooltip key={l.layer}>
                                            <TooltipTrigger>
                                              <span
                                                className={`inline-flex items-center justify-center h-5 min-w-[28px] rounded border text-[10px] font-mono font-medium px-1 ${info.color}`}
                                              >
                                                {info.short}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                              {info.title}
                                            </TooltipContent>
                                          </Tooltip>
                                        )
                                      })
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">
                                    {modeLabel(agent.mode)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {modelLabel(agent.model)}
                                  </Badge>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={agent.enabled}
                                    onCheckedChange={(c) => handleToggleEnabled(agent.slug, !!c)}
                                  />
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEdit(agent)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Edit Dialog ── */}
        <Dialog open={!!editingSlug} onOpenChange={(open) => !open && setEditingSlug(null)}>
          <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {form?.label}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {editingSlug}
                </span>
                {form &&
                  (() => {
                    const scope = deriveScope(form.layers)
                    const info = SCOPE_INFO[scope]
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${info.color}`}
                      >
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </span>
                    )
                  })()}
              </DialogTitle>
              <DialogDescription>
                Changes increment the config version. Prompts are managed in Langfuse.
              </DialogDescription>
            </DialogHeader>

            {form && (
              <Tabs defaultValue="general">
                <TabsList>
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                  <TabsTrigger value="tools-skills">Tools & Skills</TabsTrigger>
                  <TabsTrigger value="resilience">Resilience</TabsTrigger>
                </TabsList>

                {/* ── General ── */}
                <TabsContent value="general" className="space-y-5 pt-5">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="What this agent does"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>
                        Mode
                        <HelpTip text="How the AI generates output. Structured Output returns validated JSON; Text returns prose; Streaming sends tokens in real-time for chat UIs." />
                      </Label>
                      <Select
                        value={form.mode}
                        onValueChange={(v) =>
                          v &&
                          setForm({
                            ...form,
                            mode: v,
                            schemaSlug: v !== 'generateObject' ? '' : form.schemaSlug,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>{modeLabel(form.mode)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[340px]">
                          {MODE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <SelectOptionItem label={o.label} description={o.description} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>
                        Model Tier
                        <HelpTip text="Fast uses Haiku (cheaper, faster). Standard uses Sonnet (more capable). The user's model preference in Settings overrides this." />
                      </Label>
                      <Select
                        value={form.model}
                        onValueChange={(v) => v && setForm({ ...form, model: v })}
                      >
                        <SelectTrigger>
                          <SelectValue>{modelLabel(form.model)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[280px]">
                          {MODEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <SelectOptionItem label={o.label} description={o.description} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {form.mode === 'generateObject' && (
                    <div className="space-y-1.5">
                      <Label>
                        Output Schema
                        <HelpTip text="The Zod schema that validates the AI's JSON output. Required for Structured Output mode." />
                      </Label>
                      <Select
                        value={form.schemaSlug}
                        onValueChange={(v) => v && setForm({ ...form, schemaSlug: v })}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {registries?.schemas?.find((s: any) => s.slug === form.schemaSlug)
                              ?.label ??
                              (form.schemaSlug || 'Select schema')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[460px] max-w-[560px]">
                          {registries?.schemas?.map((s: any) => (
                            <SelectItem key={s.slug} value={s.slug}>
                              <SelectOptionItem label={s.label} description={s.description} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>
                        Langfuse Prompt Name
                        <HelpTip text="The prompt name in Langfuse. The builder fetches the production-labeled version at runtime." />
                      </Label>
                      <Input
                        value={form.langfusePromptName}
                        onChange={(e) => setForm({ ...form, langfusePromptName: e.target.value })}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Max Output Tokens</Label>
                      <Input
                        type="number"
                        value={form.maxOutputTokens}
                        onChange={(e) =>
                          setForm({ ...form, maxOutputTokens: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ── Context ── */}
                <TabsContent value="context" className="space-y-5 pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <Label>
                        Context Layers
                        <HelpTip text="Layers fetch data from the database and inject it into the prompt as template variables. They run in parallel before the AI call." />
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each layer adds a level of context to the AI prompt. Without layers, the
                        agent only sees what the route explicitly passes.
                      </p>
                    </div>
                    {availableLayersToAdd.length > 0 && (
                      <Select onValueChange={(v) => typeof v === 'string' && v && addLayer(v)}>
                        <SelectTrigger className="w-[170px] h-8 text-xs shrink-0">
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          <SelectValue placeholder="Add layer" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[460px] max-w-[560px]">
                          {availableLayersToAdd.map((lo) => (
                            <SelectItem key={lo.value} value={lo.value}>
                              <SelectOptionItem label={lo.label} description={lo.description} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {form.layers.length > 0 ? (
                    <div className="space-y-3">
                      {form.layers.map((layerCfg, index) => {
                        const info = LAYER_OPTIONS.find((lo) => lo.value === layerCfg.layer)
                        return (
                          <div key={layerCfg.layer} className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm">
                                  {info?.label ?? layerCfg.layer}
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {info?.description}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLayer(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="border-t pt-3">
                              <LayerOptionsEditor
                                layer={layerCfg.layer}
                                options={layerCfg.options}
                                onChange={(opts) => updateLayerOptions(index, opts)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        No layers configured. This agent receives all context via template variable
                        overrides from the route.
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tools & Skills ── */}
                <TabsContent value="tools-skills" className="space-y-6 pt-5">
                  <div>
                    <Label>
                      Tools
                      <HelpTip text="Tools give the AI abilities like web search. Select which tools this agent can use." />
                    </Label>
                    {registries?.tools?.length ? (
                      <div className="mt-2 space-y-3">
                        {registries.tools.map((tool: any) => (
                          <div key={tool.slug} className="rounded-lg border p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={form.selectedTools.includes(tool.slug)}
                                onCheckedChange={() => toggleTool(tool.slug)}
                              />
                              <div className="flex-1">
                                <span className="font-medium text-sm">{tool.label}</span>
                                <p className="text-xs text-muted-foreground">{tool.description}</p>
                                {form.selectedTools.includes(tool.slug) &&
                                  tool.slug === 'web-search' && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <Label className="text-xs">Max search steps</Label>
                                      <Input
                                        type="number"
                                        className="w-20 h-7 text-xs"
                                        value={
                                          (form.toolOptions[tool.slug]?.maxSteps as number) ?? 3
                                        }
                                        onChange={(e) =>
                                          updateToolOption(
                                            tool.slug,
                                            'maxSteps',
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">No tools available.</p>
                    )}
                  </div>

                  <div>
                    <Label>
                      Skills
                      <HelpTip text="Skills inject domain knowledge or instructions into the prompt. Manage them in the Skills settings page." />
                    </Label>
                    {availableSkills?.length ? (
                      <div className="mt-2 space-y-2">
                        {availableSkills.map((skill: any) => (
                          <div
                            key={skill.slug}
                            className="flex items-start gap-3 rounded-lg border p-3"
                          >
                            <Checkbox
                              checked={form.selectedSkills.includes(skill.slug)}
                              onCheckedChange={() => toggleSkill(skill.slug)}
                            />
                            <div>
                              <span className="font-medium text-sm">{skill.label}</span>
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                {skill.type}
                              </Badge>
                              {skill.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {skill.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">
                        No skills created yet.{' '}
                        <a href="/settings/skills" className="underline">
                          Create one
                        </a>
                        .
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* ── Resilience ── */}
                <TabsContent value="resilience" className="space-y-5 pt-5">
                  <p className="text-sm text-muted-foreground">
                    Controls how the agent handles slow or failing context layers.
                  </p>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>
                        Layer Timeout
                        <HelpTip text="Max time (ms) to wait for a single context layer before treating it as failed." />
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={form.layerTimeout}
                          onChange={(e) =>
                            setForm({ ...form, layerTimeout: Number(e.target.value) })
                          }
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">ms</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Total Timeout
                        <HelpTip text="Max total time (ms) for the full agent execution." />
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={form.totalTimeout}
                          onChange={(e) =>
                            setForm({ ...form, totalTimeout: Number(e.target.value) })
                          }
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">ms</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <Switch
                      checked={form.fallbackOnLayerError}
                      onCheckedChange={(c) => setForm({ ...form, fallbackOnLayerError: !!c })}
                    />
                    <div>
                      <p className="text-sm font-medium">Continue on layer failure</p>
                      <p className="text-xs text-muted-foreground">
                        {form.fallbackOnLayerError
                          ? 'Agent runs with partial context if a layer fails. Good for real-time features.'
                          : 'Agent fails entirely if any layer fails. Use for features where incomplete context produces wrong output.'}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setEditingSlug(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
