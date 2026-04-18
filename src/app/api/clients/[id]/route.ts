import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getClientWithRelations, updateClient, softDeleteClient } from '@/lib/db/queries/clients'
import { parseJSON } from '@/lib/api/utils'
import { CLIENT_STATUSES } from '@/lib/db/schema'

const updateClientSchema = z
  .object({
    name: z.string().min(1),
    industry: z.string().min(1),
    website: z.string().url().optional().or(z.literal('')),
    hqLocation: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(CLIENT_STATUSES).optional(),
  })
  .partial()

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserId()
    const { id } = await params
    const client = await getClientWithRelations(id)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { data, error } = await parseJSON(request)
    if (error) return error

    const parsed = updateClientSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const client = await updateClient(id, parsed.data)
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const result = await softDeleteClient(id)
    if (!result) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Client deleted' })
  } catch (error) {
    return handleAPIError(error)
  }
}
