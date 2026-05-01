import type { SupabaseClient } from "@supabase/supabase-js"

export type ContactMessageSupportStatus = "new" | "triaged" | "ticket_created" | "resolved"

export type ContactMessageSource = "contact_form" | "messages_support"

export type ContactMessageRow = {
  id: string
  name: string
  email: string
  subject: string | null
  message: string
  created_at: string
  support_status: ContactMessageSupportStatus
  internal_notes: string | null
  updated_at: string
  source: ContactMessageSource
  user_id: string | null
  related_conversation_id: string | null
  support_conversation_id: string | null
}

/** Columns loaded by /admin/contact-messages (keep in sync with `normalizeRow`). */
export const CONTACT_MESSAGE_ADMIN_SELECT =
  "id, name, email, subject, message, created_at, support_status, internal_notes, updated_at, source, user_id, related_conversation_id, support_conversation_id"

export function normalizeContactMessageRow(raw: Record<string, unknown>): ContactMessageRow {
  const source =
    raw.source === "messages_support" ? "messages_support" : "contact_form"
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    subject: raw.subject == null || raw.subject === "" ? null : String(raw.subject),
    message: String(raw.message ?? ""),
    created_at: String(raw.created_at ?? ""),
    support_status: (raw.support_status as ContactMessageSupportStatus) ?? "new",
    internal_notes: raw.internal_notes == null ? null : String(raw.internal_notes),
    updated_at: String(raw.updated_at ?? raw.created_at ?? ""),
    source,
    user_id: raw.user_id == null ? null : String(raw.user_id),
    related_conversation_id:
      raw.related_conversation_id == null ? null : String(raw.related_conversation_id),
    support_conversation_id:
      raw.support_conversation_id == null ? null : String(raw.support_conversation_id),
  }
}

export async function getContactMessageRowById(
  supabase: SupabaseClient,
  id: string,
): Promise<ContactMessageRow | null> {
  const { data, error } = await supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return null
  }
  return normalizeContactMessageRow(data as Record<string, unknown>)
}

export async function updateContactMessageRow(
  supabase: SupabaseClient,
  args: {
    id: string
    support_status?: ContactMessageSupportStatus
    internal_notes?: string | null
  },
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = {}
  if (args.support_status !== undefined) patch.support_status = args.support_status
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes

  const { error } = await supabase.from("contact_messages").update(patch).eq("id", args.id)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}
