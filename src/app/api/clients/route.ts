import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { listClients, createClient } from '@/lib/db/queries/clients';
import { triggerCompanyResearch } from '@/lib/ai/prompts/company-research';
import { parseJSON } from '@/lib/api/utils';

const createClientSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().url().optional().or(z.literal('')),
  hqLocation: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['prospecting', 'active_poc', 'demo_ready', 'closed']).optional(),
});

export async function GET(request: Request) {
  try {
    await requireUserId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const industry = searchParams.get('industry');
    const filters = {
      search: searchParams.get('search') || undefined,
      status: status ? [status] : undefined,
      industry: industry ? [industry] : undefined,
    };
    const clients = await listClients(filters);
    return NextResponse.json(clients);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { data, error } = await parseJSON(request);
    if (error) return error;

    const parsed = createClientSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const client = await createClient(parsed.data);

    // Fire-and-forget — do NOT await
    triggerCompanyResearch(client.id, client.name, client.industry, client.website ?? undefined);

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
