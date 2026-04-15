import { generateObject, generateText, streamText, convertToModelMessages } from 'ai'
import type { LanguageModel } from 'ai'
import { z } from 'zod'
import { getTool } from './tools/registry'
import { getSchema } from './schemas/registry'
import { getLangfuseClient } from './observe'
import { buildAIInput } from './input-builder'
import type {
  AIBuilderInput,
  AIBuilderResult,
  ToolSpec,
  ResolvedSkills,
} from './types'

// ── Helpers ──

interface CompiledPrompt {
  systemPrompt: string
  userPrompt: string | null
}

function compilePrompt(langfusePrompt: any, vars: Record<string, string>): CompiledPrompt {
  if (langfusePrompt.type === 'chat') {
    const compiled = langfusePrompt.compile(vars)
    const systemMsg = compiled.find((m: any) => m.role === 'system')
    const userMsg = compiled.find((m: any) => m.role === 'user')
    return {
      systemPrompt: systemMsg?.content ?? '',
      userPrompt: userMsg?.content ?? null,
    }
  }
  return {
    systemPrompt: langfusePrompt.compile(vars),
    userPrompt: null,
  }
}

function buildSystemPrompt(
  compiled: CompiledPrompt,
  skills: ResolvedSkills,
  overrides?: AIBuilderInput['overrides']
): string {
  const parts: string[] = []

  if (skills.systemPromptFragments.length > 0) {
    parts.push(skills.systemPromptFragments.join('\n\n'))
  }

  parts.push(compiled.systemPrompt)

  if (skills.instructions.length > 0) {
    parts.push('## Additional Instructions\n' + skills.instructions.join('\n'))
  }

  if (overrides?.systemPromptAppend) {
    parts.push(overrides.systemPromptAppend)
  }

  return parts.join('\n\n').trim()
}

interface ResolvedTool {
  slug: string
  tool: unknown
  maxSteps?: number
}

function resolveTools(toolSpecs: ToolSpec[], anthropic: any): ResolvedTool[] {
  if (toolSpecs.length === 0) return []

  return toolSpecs
    .map((spec) => {
      try {
        const entry = getTool(spec.tool)
        const tool = entry.factory(anthropic, spec.options)
        if (!tool) return null

        return {
          slug: spec.tool,
          tool,
          maxSteps: (spec.options as any)?.maxSteps,
        }
      } catch (err) {
        console.warn(`[AI] Tool ${spec.tool} failed to resolve:`, err)
        return null
      }
    })
    .filter(Boolean) as ResolvedTool[]
}

// ── Prompt fetching (with Langfuse or fallback) ──

async function fetchPrompt(promptName: string, langfuse: any): Promise<any> {
  if (langfuse) {
    return langfuse.getPrompt(promptName, undefined, { label: 'production' })
  }

  // Fallback: load from local fixtures when Langfuse not configured
  const { PROMPTS } = await import('./prompts/fixtures')
  const fixture = PROMPTS.find((p) => p.name === promptName)
  if (!fixture) {
    throw new Error(`Prompt "${promptName}" not found in fixtures and Langfuse is not configured.`)
  }

  return {
    type: 'chat',
    version: 0,
    compile: (vars: Record<string, string>) => {
      const interpolate = (text: string) =>
        text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
      return fixture.prompt.map((m) => ({
        role: m.role,
        content: interpolate(m.content),
      }))
    },
  }
}

// ── Main Builder ──

export async function executeAI<T = unknown>(input: AIBuilderInput): Promise<AIBuilderResult<T>> {
  const startTime = Date.now()

  const model = input.model as LanguageModel
  const anthropic = input.anthropic

  const langfuse = getLangfuseClient()

  try {
    // Context side: layers, skills, template vars. Trace is attached once
    // we know the agent slug is valid.
    const built = await buildAIInput(input.agentSlug, input.params, {
      overrides: input.overrides,
    })
    const { config, skills, templateVars: vars, layerResults, layerTimings, layerErrors } = built

    const trace = langfuse?.trace({
      name: config.slug,
      metadata: {
        configVersion: config.version,
        mode: config.mode,
        model: config.model,
      },
    })

    const langfusePrompt = await fetchPrompt(config.langfusePromptName, langfuse)
    const resolvedTools = resolveTools(config.tools, anthropic)

    const compiled = compilePrompt(langfusePrompt, vars)
    const systemPrompt = buildSystemPrompt(compiled, skills, input.overrides)
    const userPrompt = compiled.userPrompt
      ? compiled.userPrompt + (input.overrides?.userPromptAppend ?? '')
      : undefined

    const schema =
      config.mode === 'generateObject' && config.schemaSlug
        ? getSchema(config.schemaSlug)
        : undefined

    const tools =
      resolvedTools.length > 0
        ? (Object.fromEntries(resolvedTools.map((t) => [t.slug, t.tool])) as any)
        : undefined
    const maxSteps =
      resolvedTools.length > 0 ? Math.max(...resolvedTools.map((t) => t.maxSteps ?? 3)) : undefined

    let result: Partial<AIBuilderResult<T>>

    switch (config.mode) {
      case 'generateObject': {
        if (!schema) throw new Error(`generateObject requires a schema for "${config.slug}"`)
        const r = await generateObject({
          model,
          schema,
          system: systemPrompt,
          prompt: userPrompt ?? '',
          maxOutputTokens: config.maxOutputTokens,
        })
        result = { data: r.object as T }
        break
      }

      case 'generateText': {
        const r = await generateText({
          model,
          system: systemPrompt,
          prompt: userPrompt ?? '',
          maxOutputTokens: config.maxOutputTokens,
          ...(tools ? { tools, maxSteps } : {}),
        })
        result = { text: r.text }
        break
      }

      case 'streamText': {
        if (!input.messages) throw new Error(`streamText requires messages for "${config.slug}"`)
        const r = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(input.messages),
          maxOutputTokens: config.maxOutputTokens,
          ...(tools ? { tools, maxSteps } : {}),
        })
        result = { stream: r.toUIMessageStreamResponse() }
        break
      }

      default:
        throw new Error(`Unknown AI mode: "${config.mode}"`)
    }

    trace?.generation({
      name: `${config.slug}-generation`,
      model: config.model === 'fast' ? 'claude-haiku-4-5' : 'claude-sonnet-4',
      input: { system: systemPrompt, user: userPrompt },
      output: result.data ?? result.text ?? '[stream]',
      metadata: {
        configVersion: config.version,
        promptVersion: langfusePrompt.version,
        promptName: config.langfusePromptName,
        templateVars: vars,
      },
    })

    return {
      ...result,
      meta: {
        agentSlug: config.slug,
        configVersion: config.version,
        promptVersion: langfusePrompt.version,
        model: config.model,
        layerTimings,
        totalDuration: Date.now() - startTime,
        layerErrors,
        traceId: trace?.id,
      },
    } as AIBuilderResult<T>
  } finally {
    langfuse?.flushAsync().catch(() => {})
  }
}
