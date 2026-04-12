import { generateObject, generateText, streamText, convertToModelMessages } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { getAgentBySlug } from '@/lib/db/queries/ai-agents';
import { getLayer } from './layers/registry';
import { resolveSkills } from './skills/resolver';
import { getTool } from './tools/registry';
import { getSchema } from './schemas/registry';
import { getLangfuseClient } from './observe';
import type {
  AIBuilderInput,
  AIBuilderResult,
  LayerResult,
  LayerSpec,
  ToolSpec,
  ResilienceConfig,
  ResolvedSkills,
  AIAgentConfig,
} from './types';
import { EMPTY_SKILLS } from './types';

// ── Helpers ──

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

async function runLayers(
  specs: LayerSpec[],
  params: AIBuilderInput['params'],
  resilience: ResilienceConfig,
  trace?: any,
): Promise<{
  results: LayerResult[];
  timings: Record<string, number>;
  errors: Array<{ layer: string; error: string }>;
}> {
  const timings: Record<string, number> = {};
  const errors: Array<{ layer: string; error: string }> = [];

  const results = await Promise.all(
    specs.map(async (spec) => {
      const span = trace?.span({ name: `layer:${spec.layer}` });
      const start = Date.now();
      try {
        const layer = getLayer(spec.layer);
        const result = await Promise.race([
          layer.resolve(params, spec.options),
          rejectAfter(resilience.layerTimeout, `Layer ${spec.layer} timed out after ${resilience.layerTimeout}ms`),
        ]);
        timings[spec.layer] = Date.now() - start;
        span?.end({ output: { timing: timings[spec.layer], varsKeys: Object.keys(result.templateVars) } });
        return result;
      } catch (err) {
        const duration = Date.now() - start;
        timings[spec.layer] = duration;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ layer: spec.layer, error: errorMsg });
        span?.end({ output: { timing: duration, error: errorMsg }, level: 'ERROR' });
        console.warn(`[AI] Layer ${spec.layer} failed (${duration}ms):`, errorMsg);

        if (!resilience.fallbackOnLayerError) {
          throw new Error(`Layer ${spec.layer} failed and fallbackOnLayerError is false: ${errorMsg}`);
        }
        return { data: {}, templateVars: {} } as LayerResult;
      }
    })
  );

  return { results, timings, errors };
}

function mergeLayerTemplateVars(results: LayerResult[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const r of results) {
    Object.assign(vars, r.templateVars);
  }
  return vars;
}

interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string | null;
}

function compilePrompt(
  langfusePrompt: any,
  vars: Record<string, string>,
): CompiledPrompt {
  if (langfusePrompt.type === 'chat') {
    const compiled = langfusePrompt.compile(vars);
    const systemMsg = compiled.find((m: any) => m.role === 'system');
    const userMsg = compiled.find((m: any) => m.role === 'user');
    return {
      systemPrompt: systemMsg?.content ?? '',
      userPrompt: userMsg?.content ?? null,
    };
  }
  return {
    systemPrompt: langfusePrompt.compile(vars),
    userPrompt: null,
  };
}

function buildSystemPrompt(
  compiled: CompiledPrompt,
  skills: ResolvedSkills,
  overrides?: AIBuilderInput['overrides'],
): string {
  const parts: string[] = [];

  if (skills.systemPromptFragments.length > 0) {
    parts.push(skills.systemPromptFragments.join('\n\n'));
  }

  parts.push(compiled.systemPrompt);

  if (skills.instructions.length > 0) {
    parts.push('## Additional Instructions\n' + skills.instructions.join('\n'));
  }

  if (overrides?.systemPromptAppend) {
    parts.push(overrides.systemPromptAppend);
  }

  return parts.join('\n\n').trim();
}

interface ResolvedTool {
  slug: string;
  tool: unknown;
  maxSteps?: number;
}

function resolveTools(toolSpecs: ToolSpec[], anthropic: any): ResolvedTool[] {
  if (toolSpecs.length === 0) return [];

  return toolSpecs
    .map((spec) => {
      try {
        const entry = getTool(spec.tool);
        const tool = entry.factory(anthropic, spec.options);
        if (!tool) return null;

        return {
          slug: spec.tool,
          tool,
          maxSteps: (spec.options as any)?.maxSteps,
        };
      } catch (err) {
        console.warn(`[AI] Tool ${spec.tool} failed to resolve:`, err);
        return null;
      }
    })
    .filter(Boolean) as ResolvedTool[];
}

// ── Prompt fetching (with Langfuse or fallback) ──

async function fetchPrompt(promptName: string, langfuse: any): Promise<any> {
  if (langfuse) {
    return langfuse.getPrompt(promptName, undefined, { label: 'production' });
  }

  // Fallback: load from local fixtures when Langfuse not configured
  const { PROMPTS } = await import('./prompts/fixtures');
  const fixture = PROMPTS.find((p) => p.name === promptName);
  if (!fixture) {
    throw new Error(`Prompt "${promptName}" not found in fixtures and Langfuse is not configured.`);
  }

  return {
    type: 'chat',
    version: 0,
    compile: (vars: Record<string, string>) => {
      const interpolate = (text: string) =>
        text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
      return fixture.prompt.map((m) => ({
        role: m.role,
        content: interpolate(m.content),
      }));
    },
  };
}

// ── Main Builder ──

export async function executeAI<T = unknown>(
  input: AIBuilderInput
): Promise<AIBuilderResult<T>> {
  const startTime = Date.now();

  const config = await getAgentBySlug(input.agentSlug);
  if (!config) throw new Error(`Unknown AI agent: "${input.agentSlug}"`);

  const model = input.model as LanguageModel;
  const anthropic = input.anthropic;

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    name: config.slug,
    metadata: {
      configVersion: config.version,
      mode: config.mode,
      model: config.model,
    },
  });

  try {
    const layerResults = config.layers.length > 0
      ? await runLayers(config.layers, input.params, config.resilience, trace)
      : { results: [], timings: {}, errors: [] };

    const [skills, langfusePrompt] = await Promise.all([
      config.skills.length > 0 ? resolveSkills(config.skills) : EMPTY_SKILLS,
      fetchPrompt(config.langfusePromptName, langfuse),
    ]);
    const resolvedTools = resolveTools(config.tools, anthropic);

    const vars: Record<string, string> = {
      ...mergeLayerTemplateVars(layerResults.results),
      ...skills.contextEnrichments,
      ...input.overrides?.templateVars,
    };

    const compiled = compilePrompt(langfusePrompt, vars);
    const systemPrompt = buildSystemPrompt(compiled, skills, input.overrides);
    const userPrompt = compiled.userPrompt
      ? compiled.userPrompt + (input.overrides?.userPromptAppend ?? '')
      : undefined;

    const schema = config.mode === 'generateObject' && config.schemaSlug
      ? getSchema(config.schemaSlug)
      : undefined;

    const tools = resolvedTools.length > 0
      ? Object.fromEntries(resolvedTools.map((t) => [t.slug, t.tool])) as any
      : undefined;
    const maxSteps = resolvedTools.length > 0
      ? Math.max(...resolvedTools.map((t) => t.maxSteps ?? 3))
      : undefined;

    let result: Partial<AIBuilderResult<T>>;

    switch (config.mode) {
      case 'generateObject': {
        if (!schema) throw new Error(`generateObject requires a schema for "${config.slug}"`);
        const r = await generateObject({
          model,
          schema,
          system: systemPrompt,
          prompt: userPrompt ?? '',
          maxOutputTokens: config.maxOutputTokens,
        });
        result = { data: r.object as T };
        break;
      }

      case 'generateText': {
        const r = await generateText({
          model,
          system: systemPrompt,
          prompt: userPrompt ?? '',
          maxOutputTokens: config.maxOutputTokens,
          ...(tools ? { tools, maxSteps } : {}),
        });
        result = { text: r.text };
        break;
      }

      case 'streamText': {
        if (!input.messages) throw new Error(`streamText requires messages for "${config.slug}"`);
        const r = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(input.messages),
          maxOutputTokens: config.maxOutputTokens,
          ...(tools ? { tools, maxSteps } : {}),
        });
        result = { stream: r.toUIMessageStreamResponse() };
        break;
      }

      default:
        throw new Error(`Unknown AI mode: "${config.mode}"`);
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
    });

    return {
      ...result,
      meta: {
        agentSlug: config.slug,
        configVersion: config.version,
        promptVersion: langfusePrompt.version,
        model: config.model,
        layerTimings: layerResults.timings,
        totalDuration: Date.now() - startTime,
        layerErrors: layerResults.errors,
        traceId: trace?.id,
      },
    } as AIBuilderResult<T>;

  } finally {
    langfuse?.flushAsync().catch(() => {});
  }
}
