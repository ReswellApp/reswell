import type { SupabaseClient } from "@supabase/supabase-js"

export type ContactMessageSupportStatus = "new" | "triaged" | "ticket_created" | "resolved"

export type ContactMessageRow = {
  id: string
  name: string
  email: string
  message: string
  created_at: string
  support_status: ContactMessageSupportStatus
  ticket_url: string | null
  internal_notes: string | null
  updated_at: string
}

export async function updateContactMessageRow(
  supabase: SupabaseClient,
  args: {
    id: string
    support_status?: ContactMessageSupportStatus
    ticket_url?: string | null
    internal_notes?: string | null
  },
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = {}
  if (args.support_status !== undefined) patch.support_status = args.support_status
  if (args.ticket_url !== undefined) patch.ticket_url = args.ticket_url
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes

  const { error } = await supabase.from("contact_messages").update(patch).eq("id", args.id)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}
