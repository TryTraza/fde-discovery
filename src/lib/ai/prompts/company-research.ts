import 'server-only';
import { generateText, stepCountIs } from 'ai';
import { getAIConfig } from '@/lib/ai/get-ai-config';
import { updateClient } from '@/lib/db/queries/clients';

export async function triggerCompanyResearch(
  clientId: string,
  name: string,
  industry: string,
  website?: string
): Promise<void> {
  try {
    const { model, anthropic } = await getAIConfig('research');

    const websiteContext = website ? `Their website is ${website}.` : '';
    const { text } = await generateText({
      model,
      tools: { web_search: anthropic.tools.webSearch_20250305() } as any,
      stopWhen: stepCountIs(3),
      maxOutputTokens: 1500,
      system: 'You are a business research analyst. Provide a concise company overview.',
      prompt: `Research the company "${name}" in the ${industry} industry. ${websiteContext} Provide a brief summary covering: what they do, their size/scale, key products or services, and any notable recent news.`,
    });

    await updateClient(clientId, { aiSummary: text });
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_API_KEY') {
      await updateClient(clientId, {
        aiSummary: 'No API key configured. Go to Settings to add your Anthropic API key.',
      });
      return;
    }
    await updateClient(clientId, {
      aiSummary: 'Unable to complete company research at this time. Try again later.',
    });
  }
}
