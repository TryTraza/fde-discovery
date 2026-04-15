import { getProcessWithModel } from '@/lib/db/queries/processes'
import { getSessionById } from '@/lib/db/queries/sessions'
import type { ProcessHypothesis } from '@/lib/ai/contracts'
import {
  EMPTY_LAYER_RESULT,
  type ContextLayer,
  type LayerParams,
  type LayerResult,
  type L3Options,
} from './types'

function formatStructuredHypothesis(h: ProcessHypothesis | null | undefined): string {
  if (!h) return ''
  const lines: string[] = ['### Structured Hypothesis', h.summary]
  if (h.triggers.length > 0) {
    lines.push('\n#### Triggers')
    for (const t of h.triggers) {
      lines.push(`- ${t.description}${t.frequency ? ` (${t.frequency})` : ''}`)
    }
  }
  if (h.stakeholders.length > 0) {
    lines.push('\n#### Stakeholders')
    for (const s of h.stakeholders) lines.push(`- **${s.role}** — ${s.responsibility}`)
  }
  if (h.assumptions.length > 0) {
    lines.push('\n#### Assumptions')
    for (const a of h.assumptions) {
      lines.push(
        `- [${a.confidence}] ${a.text}${a.validationQuestion ? ` — validate: ${a.validationQuestion}` : ''}`
      )
    }
  }
  if (h.openQuestions.length > 0) {
    lines.push('\n#### Open questions')
    for (const q of h.openQuestions) lines.push(`- ${q}`)
  }
  return lines.join('\n')
}

function formatProcessModel(model: { steps?: any[]; systems?: any[]; edgeCases?: any[] }): string {
  const parts: string[] = ['## Current Process Model']

  const steps = model.steps ?? []
  if (steps.length > 0) {
    parts.push('### Steps')
    parts.push(
      steps
        .map((s: any) => {
          const systems = s.systems?.length
            ? ` (Systems: ${Array.isArray(s.systems) ? s.systems.map((sys: any) => (typeof sys === 'string' ? sys : sys.name)).join(', ') : ''})`
            : ''
          return `${s.order ?? '-'}. **${s.name}**: ${s.description}${systems}`
        })
        .join('\n')
    )
  }

  const systems = model.systems ?? []
  if (systems.length > 0) {
    parts.push('### Systems')
    parts.push(
      systems
        .map(
          (s: any) =>
            `- **${s.name}**${s.confirmed ? ' (confirmed)' : ' (inferred)'}${s.detailNotes ? `: ${s.detailNotes}` : ''}`
        )
        .join('\n')
    )
  }

  const edges = model.edgeCases ?? []
  if (edges.length > 0) {
    parts.push('### Edge Cases')
    parts.push(
      edges
        .map((e: any) => `- ${e.description}${e.frequency ? ` (${e.frequency})` : ''}`)
        .join('\n')
    )
  }

  return parts.join('\n\n')
}

export const l3ProcessLayer: ContextLayer<L3Options> = {
  name: 'l3-process',

  async resolve(params: LayerParams, options?: L3Options): Promise<LayerResult> {
    const includeModel = options?.includeModel ?? false
    const fields = options?.fields ?? 'full'

    // Check rawData shortcut
    const rawName = params.rawData?.processName as string | undefined
    if (rawName) {
      const vars: Record<string, string> = {
        processName: rawName,
        processDescription: (params.rawData?.processDescription as string) ?? '',
        processDepartment: (params.rawData?.processDepartment as string) ?? '',
        processModelSection: '',
      }
      return { data: { process: params.rawData }, templateVars: vars }
    }

    // Resolve processId from chain
    let processId = params.processId

    if (!processId && params.sessionId) {
      const session = await getSessionById(params.sessionId)
      processId = session?.processId ?? undefined
    }

    if (!processId) return EMPTY_LAYER_RESULT

    const processWithModel = await getProcessWithModel(processId)
    if (!processWithModel) return EMPTY_LAYER_RESULT

    const vars: Record<string, string> = {
      processName: processWithModel.name,
      processDescription: processWithModel.description ?? '',
      processDepartment: processWithModel.departmentTag ?? '',
      processModelSection: '',
    }

    if (includeModel && processWithModel.processModel) {
      vars.processModelSection = formatProcessModel(processWithModel.processModel as any)
    }

    if (fields === 'full') {
      const lines = [
        `## Process: ${processWithModel.name}`,
        processWithModel.description ? `- Description: ${processWithModel.description}` : null,
        processWithModel.departmentTag ? `- Department: ${processWithModel.departmentTag}` : null,
        processWithModel.status ? `- Status: ${processWithModel.status}` : null,
        processWithModel.processTypeL1 ? `- Domain: ${processWithModel.processTypeL1}` : null,
        processWithModel.hypothesisText
          ? `\n### Hypothesis\n${processWithModel.hypothesisText}`
          : null,
      ].filter(Boolean)

      vars.processSection = lines.join('\n')
      vars.processStatus = processWithModel.status ?? ''
      vars.processType = processWithModel.processTypeL1 ?? ''
      vars.processHypothesis = processWithModel.hypothesisText ?? ''
      vars.processHypothesisSection = formatStructuredHypothesis(processWithModel.hypothesis)
    }

    return {
      data: {
        process: processWithModel,
        processModel: processWithModel.processModel,
        hypothesis: processWithModel.hypothesis ?? null,
        graph: processWithModel.processModel?.graph ?? null,
      },
      templateVars: vars,
    }
  },
}
