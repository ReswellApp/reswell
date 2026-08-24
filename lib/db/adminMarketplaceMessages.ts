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

/** Row for admin marketplace conversation (thread) inbox list. */
export type AdminMarketplaceConversationListRow = {
  id: string
  last_message_at: string | null
  created_at: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  listing: { title: string | null; listing_images: { url: string }[] | null } | null
  buyer: {
    id: string
    display_name: string | null
    avatar_url: string | null
    shop_verified: boolean | null
  } | null
  seller: {
    id: string
    display_name: string | null
    avatar_url: string | null
    shop_verified: boolean | null
  } | null
  messages: { content: string; created_at: string; sender_id: string }[]
}

const CONVERSATION_LIST_SELECT = `
  id,
  last_message_at,
  created_at,
  listing_id,
  buyer_id,
  seller_id,
  listing:listings (title, listing_images(url)),
  buyer:profiles!conversations_buyer_id_fkey (id, display_name, avatar_url, shop_verified),
  seller:profiles!conversations_seller_id_fkey (id, display_name, avatar_url, shop_verified),
  messages (content, created_at, sender_id)
`

export type ListAdminMarketplaceConversationsArgs = {
  limit: number
  offset: number
  /** Plain-text substring; wildcards stripped. */
  search: string | undefined
}

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

function formatInList(ids: string[]): string {
  return ids.join(",")
}

function conversationLastActivityMs(conv: AdminMarketplaceConversationListRow): number {
  let maxMs = 0
  if (conv.last_message_at) {
    const fromConv = new Date(conv.last_message_at).getTime()
    if (Number.isFinite(fromConv)) maxMs = fromConv
  }
  for (const message of conv.messages ?? []) {
    const t = new Date(message.created_at).getTime()
    if (Number.isFinite(t) && t > maxMs) maxMs = t
  }
  if (maxMs === 0 && conv.created_at) {
    const fromCreated = new Date(conv.created_at).getTime()
    if (Number.isFinite(fromCreated)) maxMs = fromCreated
  }
  return maxMs
}

function sortConversationsByRecentActivity(
  rows: AdminMarketplaceConversationListRow[],
): AdminMarketplaceConversationListRow[] {
  return [...rows].sort((a, b) => {
    const delta = conversationLastActivityMs(b) - conversationLastActivityMs(a)
    if (delta !== 0) return delta
    return a.id.localeCompare(b.id)
  })
}

/**
 * Paginated conversation threads for admin inbox (newest activity first).
 * When `search` is set, matches buyer/seller display name, listing title, or any message body in the thread.
 */
export async function listAdminMarketplaceConversations(
  supabase: SupabaseClient,
  args: ListAdminMarketplaceConversationsArgs,
): Promise<{ rows: AdminMarketplaceConversationListRow[]; count: number | null; error: PostgrestError | null }> {
  const term = args.search ? sanitizeIlikeTerm(args.search) : ""

  let convQuery = supabase.from("conversations").select(CONVERSATION_LIST_SELECT, { count: "exact" })

  if (term.length > 0) {
    const pattern = `%${term}%`
    const [msgRes, profRes, listRes] = await Promise.all([
      supabase.from("messages").select("conversation_id").ilike("content", pattern).limit(500),
      supabase.from("profiles").select("id").ilike("display_name", pattern).limit(100),
      supabase.from("listings").select("id").ilike("title", pattern).limit(100),
    ])

    const convIdsFromMessages = new Set<string>()
    for (const row of msgRes.data ?? []) {
      if (row.conversation_id) convIdsFromMessages.add(row.conversation_id)
    }
    const fromMessages = Array.from(convIdsFromMessages).slice(0, 150)
    const profileIds = (profRes.data ?? []).map((r) => r.id).filter(Boolean)
    const listingIds = (listRes.data ?? []).map((r) => r.id).filter(Boolean)

    const orParts: string[] = []
    if (fromMessages.length > 0) {
      orParts.push(`id.in.(${formatInList(fromMessages)})`)
    }
    if (profileIds.length > 0) {
      const p = formatInList(profileIds)
      orParts.push(`buyer_id.in.(${p})`, `seller_id.in.(${p})`)
    }
    if (listingIds.length > 0) {
      orParts.push(`listing_id.in.(${formatInList(listingIds)})`)
    }

    if (orParts.length === 0) {
      return { rows: [], count: 0, error: null }
    }

    convQuery = convQuery.or(orParts.join(","))
  }

  convQuery = convQuery
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1, { referencedTable: "messages" })
    .range(args.offset, args.offset + args.limit - 1)

  const { data, error, count } = await convQuery

  if (error) {
    return { rows: [], count: null, error }
  }

  return {
    rows: sortConversationsByRecentActivity(
      (data ?? []) as unknown as AdminMarketplaceConversationListRow[],
    ),
    count,
    error: null,
  }
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
