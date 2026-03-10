import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils';
import { getClientById } from '@/lib/db/queries/clients';
import { listContactsByClient, createContact } from '@/lib/db/queries/contacts';
import { parseJSON } from '@/lib/api/utils';

const createContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUserId();
    const { id } = await params;
    const contacts = await listContactsByClient(id);
    return NextResponse.json(contacts);
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Step 1: Verify client exists BEFORE touching the body
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Step 2: Parse body (only reached if client exists)
    const { data, error } = await parseJSON(request);
    if (error) return error;

    // Step 3: Validate fields
    const parsed = createContactSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const contact = await createContact({ clientId: id, ...parsed.data });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return handleAPIError(error);
  }
}
