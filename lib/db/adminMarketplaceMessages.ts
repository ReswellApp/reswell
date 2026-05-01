import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { parseMarketplaceMessagePdfAttachment } from "@/lib/validations/marketplace-message-attachment"

/** Row for admin marketplace message list / thread (joined conversation + listing + profiles). */
export type AdminMarketplaceMessageListRow = {
  id: string
  content: string
  created_at: string
  is_read: boolean | null
  sender_id: string
  conversation_id: string
  offer_id: string | null
  metadata: unknown | null
  sender: { display_name: string | null } | null
  conversation: {
    id: string
    buyer_id: string
    seller_id: string
    listing_id: string | null
    listing: { title: string | null } | null
    buyer: { display_name: string | null } | null
    seller: { display_name: string | null } | null
  }
}

const LIST_SELECT = `
  id,
  content,
  created_at,
  is_read,
  sender_id,
  conversation_id,
  offer_id,
  metadata,
  conversation:conversations!inner (
    id,
    buyer_id,
    seller_id,
    listing_id,
    listing:listings (title),
    buyer:profiles!conversations_buyer_id_fkey (display_name),
    seller:profiles!conversations_seller_id_fkey (display_name)
  ),
  sender:profiles!messages_sender_id_fkey (display_name)
`

export type ListAdminMarketplaceMessagesArgs = {
  limit: number
  offset: number
  order: "asc" | "desc"
  conversationId: string | undefined
  /** Plain-text substring; wildcards stripped. */
  search: string | undefined
}

function sanitizeIlikeTerm(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "").slice(0, 200)
}

/**
 * Paginated marketplace DMs for admin / support (service-role client recommended).
 */
export async function listAdminMarketplaceMessages(
  supabase: SupabaseClient,
  args: ListAdminMarketplaceMessagesArgs,
): Promise<{ rows: AdminMarketplaceMessageListRow[]; count: number | null; error: PostgrestError | null }> {
  let q = supabase
    .from("messages")
    .select(LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: args.order === "asc" })

  if (args.conversationId) {
    q = q.eq("conversation_id", args.conversationId)
  }

  const term = args.search ? sanitizeIlikeTerm(args.search) : ""
  if (term.length > 0) {
    q = q.ilike("content", `%${term}%`)
  }

  q = q.range(args.offset, args.offset + args.limit - 1)

  const { data, error, count } = await q

  if (error) {
    return { rows: [], count: null, error }
  }

  return {
    rows: (data ?? []) as unknown as AdminMarketplaceMessageListRow[],
    count,
    error: null,
  }
}

export type DeleteMarketplaceMessageAsAdminResult =
  | { ok: true; conversationId: string }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "db_error"; error: PostgrestError }

/**
 * Hard-delete a thread message (service role). Reconciles `conversations.last_message_at`.
 */
export async function deleteMarketplaceMessageAsAdmin(
  supabase: SupabaseClient,
  messageId: string,
): Promise<DeleteMarketplaceMessageAsAdminResult> {
  const { data: deleted, error: delErr } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .select("conversation_id, metadata")
    .maybeSingle()

  if (delErr) {
    return { ok: false, kind: "db_error", error: delErr }
  }
  if (!deleted?.conversation_id) {
    return { ok: false, kind: "not_found" }
  }

  const attachment = parseMarketplaceMessagePdfAttachment(deleted.metadata)
  if (attachment) {
    const { error: rmErr } = await supabase.storage.from(attachment.bucket).remove([attachment.path])
    if (rmErr) {
      console.error("[deleteMarketplaceMessageAsAdmin] storage remove:", rmErr.message)
    }
  }

  const conversationId = deleted.conversation_id

  const { data: latest, error: latestErr } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) {
    console.error("[deleteMarketplaceMessageAsAdmin] latest message:", latestErr.message)
  }

  let nextLastAt: string
  if (latest?.created_at) {
    nextLastAt = latest.created_at
  } else {
    const { data: conv, error: convReadErr } = await supabase
      .from("conversations")
      .select("created_at")
      .eq("id", conversationId)
      .maybeSingle()
    if (convReadErr) {
      console.error("[deleteMarketplaceMessageAsAdmin] conversation read:", convReadErr.message)
    }
    nextLastAt = conv?.created_at ?? new Date().toISOString()
  }

  const { error: convUpdErr } = await supabase
    .from("conversations")
    .update({ last_message_at: nextLastAt })
    .eq("id", conversationId)

  if (convUpdErr) {
    console.error("[deleteMarketplaceMessageAsAdmin] conversation update:", convUpdErr.message)
  }

  return { ok: true, conversationId }
}
