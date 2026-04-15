import type { LanguageModel } from 'ai';
import { executeAI } from './builder';
import { updateClient } from '@/lib/db/queries/clients';

/**
 * Fire-and-forget company research via executeAI.
 * Model must be pre-resolved (call getAIConfig before invoking).
 */
export function triggerCompanyResearchViaBuilder(
  clientId: string,
  client: { name: string; industry: string; website?: string | null },
  model: LanguageModel,
  anthropic: any,
) {
  executeAI({
    agentSlug: 'company-research',
    params: {},
    userId: '',
    model,
    anthropic,
    overrides: {
      templateVars: {
        clientName: client.name,
        clientIndustry: client.industry,
        clientWebsite: client.website ? `Their website is ${client.website}.` : '',
      },
    },
  })
    .then(async (result) => {
      await updateClient(clientId, { aiSummary: result.text ?? '' });
    })
    .catch(async (err) => {
      console.error(`[research] Failed for client ${clientId}:`, err);
      const msg = err?.message === 'NO_API_KEY'
        ? 'No API key configured. Go to Settings to add your Anthropic API key.'
        : 'Unable to complete company research at this time. Try again later.';
      await updateClient(clientId, { aiSummary: msg }).catch(() => {});
    });
}
