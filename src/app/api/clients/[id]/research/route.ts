import { NextResponse } from 'next/server';
import { requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getClientById } from '@/lib/db/queries/clients';
import { triggerCompanyResearch } from '@/lib/ai/prompts/company-research';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    // Fire-and-forget
    triggerCompanyResearch(id, client.name, client.industry, client.website ?? undefined);
    return NextResponse.json({ message: 'Research started' });
  } catch (error) {
    return handleAPIError(error);
  }
}
