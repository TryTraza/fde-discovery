import 'server-only';
import { streamText, convertToModelMessages, stepCountIs, UIMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { requireAdmin, requireAuthWithUser, handleAPIError } from '@/lib/auth/utils';
import { getClientById } from '@/lib/db/queries/clients';
import { getProcessById } from '@/lib/db/queries/processes';
import { getL1 } from '@/lib/domain/l1';
import { createResearchNote } from '@/lib/db/queries/research-notes';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Auth: admin-only, then get user for API key
    const { user } = await requireAuthWithUser();
    const role = (user.publicMetadata as Record<string, unknown>)?.role ?? 'viewer';
    if (role !== 'admin') throw new Error('Forbidden: admin role required');

    // Pattern D: streaming requires direct provider access
    const apiKey = (user.privateMetadata as Record<string, unknown>)?.anthropicApiKey as string | undefined;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key configured. Go to Settings.' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const anthropic = createAnthropic({ apiKey });
    const modelPrefs = (user.publicMetadata as Record<string, unknown>)?.aiModels as Record<string, string> | undefined ?? {};
    const modelId = modelPrefs.research || 'claude-sonnet-4-20250514';

    const { messages, clientId, processId }: {
      messages: UIMessage[];
      clientId?: string;
      processId?: string;
    } = await req.json();

    // Build layered context (L1 + L2)
    let context = '';
    if (clientId) {
      const client = await getClientById(clientId);
      if (client) {
        context += `Client: ${client.name}, ${client.industry}. ${client.aiSummary ?? ''}\n`;
      }
    }
    if (processId) {
      const process = await getProcessById(processId);
      if (process) {
        const l1 = getL1(process.processTypeL1 ?? 'unknown');
        context += `Process: ${process.name}. ${process.hypothesisText ?? ''}\n`;
        context += `Domain knowledge: ${JSON.stringify(l1)}\n`;
      }
    }

    const result = streamText({
      model: anthropic(modelId),
      messages: await convertToModelMessages(messages),
      tools: { web_search: anthropic.tools.webSearch_20250305() } as any,
      stopWhen: stepCountIs(5),
      system: `You are a research assistant for a Forward Deployed Engineer at Traza AI. Help them research and understand client companies, industry patterns, operational processes, and system documentation.

Current context:
${context}

Stay focused on FDE research. Be specific and actionable. Flag information that contradicts the current ProcessModel. Keep responses to 1-3 paragraphs unless asked for depth.`,
      onFinish: async ({ text }) => {
        const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
        if (lastUserMessage && clientId) {
          await createResearchNote({
            clientId,
            processId: processId ?? null,
            query: lastUserMessage.parts
              ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join('') || 'Research query',
            response: text,
            sources: [],
          }).catch(console.error);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return handleAPIError(error);
  }
}
