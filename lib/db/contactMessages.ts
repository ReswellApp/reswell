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

/** Member portal — never expose internal_notes. */
export const CONTACT_MESSAGE_USER_SELECT =
  "id, name, email, subject, message, created_at, support_status, updated_at, source, user_id, related_conversation_id, support_conversation_id"

export type ContactMessageUserRow = Omit<ContactMessageRow, "internal_notes">

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

function normalizeContactMessageUserRow(raw: Record<string, unknown>): ContactMessageUserRow {
  const row = normalizeContactMessageRow(raw)
  const { internal_notes: _ignored, ...userRow } = row
  return userRow
}

/** Website /contact form row — server-only (service role); never trust client for source/user_id. */
export async function insertContactFormMessage(
  supabase: SupabaseClient,
  row: { name: string; email: string; message: string; user_id?: string | null },
): Promise<{ id: string } | { error: Error }> {
  const { data, error } = await supabase
    .from("contact_messages")
    .insert({
      name: row.name,
      email: row.email,
      message: row.message,
      source: "contact_form",
      user_id: row.user_id ?? null,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    return { error: new Error(error?.message ?? "Insert failed") }
  }
  return { id: String(data.id) }
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

/** Admin or service-role client — not selectable by members under RLS. */
export async function findMessagesSupportTicketMetaByConversationId(
  supabase: SupabaseClient,
  supportConversationId: string,
): Promise<{ id: string; email: string; user_id: string | null } | null> {
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, email, user_id")
    .eq("support_conversation_id", supportConversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }
  return {
    id: String(data.id),
    email: String(data.email ?? "").trim(),
    user_id: data.user_id == null ? null : String(data.user_id),
  }
}

export async function updateContactMessageRow(
  supabase: SupabaseClient,
  args: {
    id: string
    support_status?: ContactMessageSupportStatus
    internal_notes?: string | null
    support_conversation_id?: string | null
  },
): Promise<{ error: Error | null }> {
  const patch: Record<string, unknown> = {}
  if (args.support_status !== undefined) patch.support_status = args.support_status
  if (args.internal_notes !== undefined) patch.internal_notes = args.internal_notes
  if (args.support_conversation_id !== undefined) {
    patch.support_conversation_id = args.support_conversation_id
  }

  const { error } = await supabase.from("contact_messages").update(patch).eq("id", args.id)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}

/** Single-query bulk status update — no per-ticket member notifications. */
export async function bulkUpdateContactMessageRows(
  supabase: SupabaseClient,
  ids: string[],
  patch: { support_status: ContactMessageSupportStatus },
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null }
  const { error } = await supabase
    .from("contact_messages")
    .update({ support_status: patch.support_status })
    .in("id", ids)
  return { error: error?.message ?? null }
}

export type UserSupportTicketFilter = "all" | "open" | "resolved"

export async function listContactMessagesForUser(
  supabase: SupabaseClient,
  userId: string,
  filter: UserSupportTicketFilter = "all",
): Promise<ContactMessageUserRow[]> {
  let query = supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_USER_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (filter === "open") {
    query = query.neq("support_status", "resolved")
  } else if (filter === "resolved") {
    query = query.eq("support_status", "resolved")
  }

  const { data, error } = await query
  if (error) {
    console.error("listContactMessagesForUser", error)
    return []
  }

  return (data ?? []).map((row) =>
    normalizeContactMessageUserRow(row as Record<string, unknown>),
  )
}

export async function getContactMessageForUser(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
): Promise<ContactMessageUserRow | null> {
  const { data, error } = await supabase
    .from("contact_messages")
    .select(CONTACT_MESSAGE_USER_SELECT)
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }
  return normalizeContactMessageUserRow(data as Record<string, unknown>)
}

export async function countOpenContactMessagesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("support_status", "resolved")

  if (error) {
    console.error("countOpenContactMessagesForUser", error)
    return 0
  }
  return count ?? 0
}

export type UnlinkedContactMessageRow = Pick<
  ContactMessageRow,
  "id" | "email" | "subject" | "message" | "source" | "support_conversation_id"
>

/** Guest submissions (contact form / pre-login) awaiting account match — service role. */
export async function listUnlinkedContactMessages(
  supabase: SupabaseClient,
  limit = 100,
): Promise<UnlinkedContactMessageRow[]> {
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, email, subject, message, source, support_conversation_id")
    .is("user_id", null)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("listUnlinkedContactMessages", error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email ?? "").trim(),
    subject: row.subject == null || row.subject === "" ? null : String(row.subject),
    message: String(row.message ?? ""),
    source: row.source === "messages_support" ? "messages_support" : "contact_form",
    support_conversation_id:
      row.support_conversation_id == null ? null : String(row.support_conversation_id),
  }))
}

export async function linkContactMessageToUser(
  supabase: SupabaseClient,
  ticketId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("contact_messages")
    .update({ user_id: userId })
    .eq("id", ticketId)
    .is("user_id", null)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}
