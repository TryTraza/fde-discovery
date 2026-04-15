import { apiClient } from '@/lib/api-client'

export interface Contact {
  id: string
  clientId: string
  name: string
  role?: string | null
  department?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export interface ContactCreateInput {
  name: string
  role?: string
  department?: string
  email?: string
  phone?: string
  notes?: string
}

export type ContactUpdateInput = Partial<ContactCreateInput>

class ContactsService {
  async listForClient(clientId: string): Promise<Contact[]> {
    return apiClient.get<Contact[]>(`/api/clients/${clientId}/contacts`)
  }

  async create(clientId: string, data: ContactCreateInput): Promise<Contact> {
    return apiClient.post<Contact>(`/api/clients/${clientId}/contacts`, data)
  }

  async update(contactId: string, data: ContactUpdateInput): Promise<Contact> {
    return apiClient.patch<Contact>(`/api/contacts/${contactId}`, data)
  }

  async delete(contactId: string): Promise<void> {
    await apiClient.delete(`/api/contacts/${contactId}`)
  }
}

export const contactsService = new ContactsService()
