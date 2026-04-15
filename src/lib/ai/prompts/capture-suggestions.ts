import type { CaptureContext } from '@/lib/ai/context/capture-context'

export function buildCapturePrompt(ctx: CaptureContext, activeType: 'STEP' | 'EDGE'): string {
  const typeLabel = activeType === 'STEP' ? 'process steps' : 'edge cases'

  return `You are assisting an FDE (Forward Deployed Engineer) during a live shadowing session.
They are observing someone perform a real business process and need quick suggestions for ${typeLabel} to log.

Process type: ${ctx.processTypeL1 ?? 'unknown'}

Current process model steps:
${ctx.processModelSteps.map((s) => `- ${s.name} (${s.confidence}): ${s.description}`).join('\n') || '(no steps yet)'}

Events logged so far this session (most recent last):
${ctx.recentEvents.map((e) => `[${e.type}] ${e.label ?? '(no label)'}`).join('\n') || '(none yet)'}

${ctx.l1Library ? `Domain knowledge:\n${JSON.stringify(ctx.l1Library, null, 2)}` : ''}

Generate 3-5 short suggestions for the NEXT likely ${typeLabel} the FDE might observe.
Each suggestion should be 3-8 words — short enough to tap quickly on a tablet.
Base suggestions on: what typically comes next in this process type, what hasn't been logged yet, and the domain patterns.

Return suggestions ranked by likelihood (most likely first).`
}
