import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserId, requireAdmin, handleAPIError } from '@/lib/auth/utils'
import { getContactById, updateContact, softDeleteContact } from '@/lib/db/queries/contacts'
import { parseJSON } from '@/lib/api/utils'

const updateContactSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().optional(),
    department: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    notes: z.string().optional(),
  })
  .partial()

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUserId()
    const { id } = await params
    const contact = await getContactById(id)
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json(contact)
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

    const parsed = updateContactSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const contact = await updateContact(id, parsed.data)
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json(contact)
  } catch (error) {
    return handleAPIError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const result = await softDeleteContact(id)
    if (!result) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Contact deleted' })
  } catch (error) {
    return handleAPIError(error)
  }
}
