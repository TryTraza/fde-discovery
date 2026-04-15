'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import { useSkills } from '@/modules/ai/hooks/use-skills'

type SkillType = 'system-prompt' | 'context-enrichment' | 'instruction'

const TYPE_OPTIONS: Array<{ value: SkillType; label: string; description: string }> = [
  {
    value: 'system-prompt',
    label: 'System Prompt',
    description:
      'Prepended to the system message before the main prompt. Use for domain knowledge.',
  },
  {
    value: 'context-enrichment',
    label: 'Context Enrichment',
    description: 'Key=value pairs merged into prompt template variables.',
  },
  {
    value: 'instruction',
    label: 'Instruction',
    description: 'Appended after the main prompt as additional instructions.',
  },
]

const TYPE_COLORS: Record<SkillType, string> = {
  'system-prompt': 'bg-violet-100 text-violet-800',
  'context-enrichment': 'bg-teal-100 text-teal-800',
  instruction: 'bg-blue-100 text-blue-800',
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface SkillFormData {
  slug: string
  label: string
  type: SkillType
  content: string
  description: string
}

const EMPTY_FORM: SkillFormData = {
  slug: '',
  label: '',
  type: 'system-prompt',
  content: '',
  description: '',
}

export default function SkillsPage() {
  const { skills, isLoading, mutateSkills } = useSkills()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SkillFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (skill: any) => {
    setEditingId(skill.id)
    setForm({
      slug: skill.slug,
      label: skill.label,
      type: skill.type,
      content: skill.content,
      description: skill.description ?? '',
    })
    setDialogOpen(true)
  }

  const handleLabelChange = (label: string) => {
    const newForm = { ...form, label }
    if (!editingId) newForm.slug = slugify(label)
    setForm(newForm)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/settings/skills/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to update skill')
        }
        toast.success('Skill updated')
      } else {
        const res = await fetch('/api/settings/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to create skill')
        }
        toast.success('Skill created')
      }
      mutateSkills()
      setDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/settings/skills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) mutateSkills()
    else toast.error('Failed to toggle skill')
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/settings/skills/${deleteId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Skill deleted')
      mutateSkills()
    } else {
      toast.error('Failed to delete skill')
    }
    setDeleteId(null)
  }

  const selectedTypeInfo = TYPE_OPTIONS.find((t) => t.value === form.type)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground">
            Domain knowledge and instructions injected into AI agent prompts.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Skill
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !skills?.length ? (
            <div className="p-6 text-center text-muted-foreground">
              No skills yet. Create one to inject domain knowledge into AI agents.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skill</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[60px]">On</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill: any) => (
                  <TableRow
                    key={skill.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(skill)}
                  >
                    <TableCell>
                      <span className="font-medium text-sm">{skill.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {skill.slug}
                      </span>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[350px]">
                          {skill.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[skill.type as SkillType]}>
                        {TYPE_OPTIONS.find((t) => t.value === skill.type)?.label ?? skill.type}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(c) => handleToggleEnabled(skill.id, !!c)}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(skill)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteId(skill.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Skill' : 'Create Skill'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the skill content. Changes apply to all agents using this skill.'
                : 'Skills inject domain knowledge or instructions into AI agent prompts.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Freight Forwarding Knowledge"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated-from-label"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used to reference this skill in agent configs.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => v && setForm({ ...form, type: v as SkillType })}
              >
                <SelectTrigger>
                  <SelectValue>{selectedTypeInfo?.label ?? form.type}</SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[500px] max-w-[560px]">
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground leading-snug whitespace-normal">
                          {t.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief explanation of what this skill provides"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Content</Label>
              {form.type === 'context-enrichment' && (
                <p className="text-xs text-muted-foreground">
                  Enter <code className="bg-muted px-1 rounded">key=value</code> pairs, one per
                  line. Keys must match{' '}
                  <code className="bg-muted px-1 rounded">{'{{variable}}'}</code> names in the
                  Langfuse prompt.
                </p>
              )}
              {form.type === 'system-prompt' && (
                <p className="text-xs text-muted-foreground">
                  Prepended to the system message before the main prompt. Supports markdown. Use for
                  domain knowledge the AI should always have.
                </p>
              )}
              {form.type === 'instruction' && (
                <p className="text-xs text-muted-foreground">
                  Appended after the main prompt as additional instructions. Supports markdown. Use
                  for behavioral rules.
                </p>
              )}

              <Tabs defaultValue="edit" className="w-full">
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="pt-2">
                  <Textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder={
                      form.type === 'context-enrichment'
                        ? 'industryContext=In freight forwarding, BOL is the primary document\ncommonSystems=SAP TM, CargoWise'
                        : form.type === 'instruction'
                          ? 'Keep responses under 3 paragraphs unless asked for more detail.'
                          : '## Domain Knowledge\n\nWhen analyzing legacy processes:\n- Look for **workarounds** (spreadsheets, sticky notes, email chains)\n- The system of record often lags behind actual practice'
                    }
                    className="font-mono text-[13px] leading-relaxed min-h-[260px] bg-muted/30 resize-y w-full"
                    rows={12}
                  />
                </TabsContent>

                <TabsContent value="preview" className="pt-2">
                  <div className="rounded-md border bg-background p-4 min-h-[260px] max-h-[400px] overflow-y-auto">
                    {form.content ? (
                      form.type === 'context-enrichment' ? (
                        <div className="space-y-1.5">
                          {form.content
                            .split('\n')
                            .filter((l) => l.trim())
                            .map((line, i) => {
                              const eqIdx = line.indexOf('=')
                              if (eqIdx === -1) {
                                return (
                                  <div key={i} className="text-xs text-amber-600">
                                    Invalid line (no &apos;=&apos;): {line}
                                  </div>
                                )
                              }
                              return (
                                <div key={i} className="flex gap-2 text-sm">
                                  <span className="font-mono font-medium text-primary">
                                    {line.slice(0, eqIdx).trim()}
                                  </span>
                                  <span className="text-muted-foreground">=</span>
                                  <span>{line.slice(eqIdx + 1).trim()}</span>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{form.content}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Start typing in the Edit tab to see a preview.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.slug || !form.label || !form.content}
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Skill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the skill from all AI agents that reference it. The skill can be
              recreated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
