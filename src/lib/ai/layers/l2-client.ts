import { getClientById } from '@/lib/db/queries/clients';
import { getProcessById } from '@/lib/db/queries/processes';
import { getSessionById } from '@/lib/db/queries/sessions';
import { EMPTY_LAYER_RESULT, type ContextLayer, type LayerParams, type LayerResult, type L2Options } from './types';

export const l2ClientLayer: ContextLayer<L2Options> = {
  name: 'l2-client',

  async resolve(params: LayerParams, options?: L2Options): Promise<LayerResult> {
    const fields = options?.fields ?? 'full';

    // Check rawData shortcut
    const rawName = params.rawData?.clientName as string | undefined;
    const rawIndustry = params.rawData?.clientIndustry as string | undefined;
    if (rawName && rawIndustry) {
      const vars: Record<string, string> = {
        clientName: rawName,
        clientIndustry: rawIndustry,
      };
      const rawWebsite = params.rawData?.clientWebsite as string | undefined;
      if (rawWebsite) vars.clientWebsite = rawWebsite;
      return { data: { client: params.rawData }, templateVars: vars };
    }

    // Resolve clientId from chain
    let clientId = params.clientId;

    if (!clientId && params.processId) {
      const process = await getProcessById(params.processId);
      clientId = process?.clientId ?? undefined;
    }

    if (!clientId && params.sessionId) {
      const session = await getSessionById(params.sessionId);
      if (session?.processId) {
        const process = await getProcessById(session.processId);
        clientId = process?.clientId ?? undefined;
      }
    }

    if (!clientId) return EMPTY_LAYER_RESULT;

    const client = await getClientById(clientId);
    if (!client) return EMPTY_LAYER_RESULT;

    const vars: Record<string, string> = {
      clientName: client.name,
      clientIndustry: client.industry,
      clientWebsite: client.website ?? '',
    };

    if (fields === 'full') {
      const lines = [
        `## Client: ${client.name}`,
        `- Industry: ${client.industry}`,
        client.website ? `- Website: ${client.website}` : null,
        client.hqLocation ? `- HQ: ${client.hqLocation}` : null,
        client.status ? `- Status: ${client.status}` : null,
        client.aiSummary ? `\n### AI Summary\n${client.aiSummary}` : null,
        client.notes ? `\n### Notes\n${client.notes}` : null,
      ].filter(Boolean);

      vars.clientSection = lines.join('\n');
      vars.clientStatus = client.status ?? '';
      vars.clientAiSummary = client.aiSummary ?? '';
      vars.clientNotes = client.notes ?? '';
      vars.clientHqLocation = client.hqLocation ?? '';
    }

    return { data: { client }, templateVars: vars };
  },
};
