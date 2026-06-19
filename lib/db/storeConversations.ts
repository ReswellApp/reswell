import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Store-scoped reads of buyer↔shop conversations for a consignment store's listings.
 *
 * Conversations RLS only admits the two named participants (buyer + seller). For a consigned
 * listing the seller of record is the shop OWNER, so non-owner staff cannot read these threads
 * under RLS. The shop inbox therefore reads via the service-role client AFTER the caller has
 * authorized the viewer as store staff (getStoreStaffRole). Never call these without that gate.
 */

function pickCover(
  images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null,
): string | null {
  const list = images ?? []
  const cover =
    list.find((img) => img.is_primary) ??
    [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
    null
  return cover?.url ?? null
}

export type StoreConversationListItem = {
  conversationId: string
  buyerName: string
  buyerAvatarUrl: string | null
  listingId: string
  listingTitle: string
  listingCoverUrl: string | null
  consignorName: string | null
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
}

export type StoreThreadMessage = {
  id: string
  fromShop: boolean
  content: string
  createdAt: string
  staffProfileId: string | null
}

export type StoreConversationThread = {
  conversationId: string
  buyerId: string
  sellerId: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingCoverUrl: string | null
  buyerName: string
  buyerAvatarUrl: string | null
  consignorName: string | null
  messages: StoreThreadMessage[]
}

type ListingRow = {
  id: string
  title: string | null
  consignor_profile_id: string | null
  listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
}

async function resolveConsignorNames(
  service: ReturnType<typeof createServiceRoleClient>,
  consignorIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = [...new Set(consignorIds.filter(Boolean))]
  if (unique.length === 0) return names

  const { data } = await service
    .from("profiles")
    .select("id, display_name")
    .in("id", unique)

  for (const row of (data ?? []) as { id: string; display_name: string | null }[]) {
    if (row.display_name) names.set(row.id, row.display_name)
  }
  return names
}

/** Conversations on this store's consignment listings, newest activity first. */
export async function listStoreConversations(
  storeId: string,
  ownerProfileId: string,
  limit = 50,
): Promise<StoreConversationListItem[]> {
  const service = createServiceRoleClient()

  const { data: listingData, error: listingErr } = await service
    .from("listings")
    .select("id, title, consignor_profile_id, listing_images(url, is_primary, sort_order)")
    .eq("consignment_store_id", storeId)
    .limit(1000)

  if (listingErr) {
    console.error("[storeConversations] listings:", listingErr)
    return []
  }

  const listings = (listingData ?? []) as ListingRow[]
  if (listings.length === 0) return []

  const listingById = new Map<string, ListingRow>(listings.map((l) => [l.id, l]))
  const listingIds = listings.map((l) => l.id)
  const consignorNames = await resolveConsignorNames(
    service,
    listings.map((l) => l.consignor_profile_id).filter((id): id is string => !!id),
  )

  const { data: convData, error: convErr } = await service
    .from("conversations")
    .select(
      `id, buyer_id, listing_id, last_message_at,
       buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
       messages(id, content, sender_id, is_read, created_at)`,
    )
    .in("listing_id", listingIds)
    .order("last_message_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(limit)
    .limit(1, { referencedTable: "messages" })

  if (convErr) {
    console.error("[storeConversations] conversations:", convErr)
    return []
  }

  type ConvRow = {
    id: string
    buyer_id: string
    listing_id: string | null
    last_message_at: string | null
    buyer: { id: string; display_name: string | null; avatar_url: string | null } | null
    messages: { id: string; content: string; sender_id: string; is_read: boolean; created_at: string }[] | null
  }

  const convs = (convData ?? []) as ConvRow[]
  // Only threads with at least one message belong in the inbox.
  const withMessages = convs.filter((c) => (c.messages ?? []).length > 0)
  if (withMessages.length === 0) return []

  const unreadByConversation = await countUnreadForShop(
    service,
    withMessages.map((c) => c.id),
    ownerProfileId,
  )

  return withMessages.map((c) => {
    const listing = c.listing_id ? listingById.get(c.listing_id) : undefined
    const latest = c.messages?.[0] ?? null
    const consignorId = listing?.consignor_profile_id ?? null
    return {
      conversationId: c.id,
      buyerName: c.buyer?.display_name ?? "Buyer",
      buyerAvatarUrl: c.buyer?.avatar_url ?? null,
      listingId: c.listing_id ?? "",
      listingTitle: listing?.title ?? "Listing",
      listingCoverUrl: pickCover(listing?.listing_images ?? null),
      consignorName: consignorId ? consignorNames.get(consignorId) ?? null : null,
      lastMessagePreview: latest?.content ?? null,
      lastMessageAt: c.last_message_at,
      unreadCount: unreadByConversation.get(c.id) ?? 0,
    }
  })
}

/** Unread = messages on these threads not sent by the shop owner and not yet read. */
async function countUnreadForShop(
  service: ReturnType<typeof createServiceRoleClient>,
  conversationIds: string[],
  ownerProfileId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (conversationIds.length === 0) return counts

  const { data } = await service
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", ownerProfileId)
    .limit(5000)

  for (const row of (data ?? []) as { conversation_id: string }[]) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1)
  }
  return counts
}

/**
 * Full thread for the shop inbox. Returns null when the conversation does not belong to a
 * consigned listing for this store (prevents staff from reading unrelated threads by id).
 */
export async function getStoreConversationThread(
  storeId: string,
  conversationId: string,
): Promise<StoreConversationThread | null> {
  const service = createServiceRoleClient()

  const { data: conv, error } = await service
    .from("conversations")
    .select(
      `id, buyer_id, seller_id, listing_id,
       buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
       listing:listings(id, title, slug, consignment_store_id, consignor_profile_id, listing_images(url, is_primary, sort_order))`,
    )
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !conv) return null

  type Row = {
    id: string
    buyer_id: string
    seller_id: string
    listing_id: string | null
    buyer: { id: string; display_name: string | null; avatar_url: string | null } | null
    listing: {
      id: string
      title: string | null
      slug: string | null
      consignment_store_id: string | null
      consignor_profile_id: string | null
      listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
    } | null
  }

  const row = conv as Row
  if (!row.listing || row.listing.consignment_store_id !== storeId) {
    return null
  }

  const { data: msgData } = await service
    .from("messages")
    .select("id, sender_id, content, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500)

  const messages: StoreThreadMessage[] = (
    (msgData ?? []) as {
      id: string
      sender_id: string
      content: string
      created_at: string
      metadata: { sent_by_staff_profile_id?: string } | null
    }[]
  ).map((m) => ({
    id: m.id,
    fromShop: m.sender_id === row.seller_id,
    content: m.content,
    createdAt: m.created_at,
    staffProfileId: m.metadata?.sent_by_staff_profile_id ?? null,
  }))

  const consignorId = row.listing.consignor_profile_id
  const consignorNames = consignorId
    ? await resolveConsignorNames(service, [consignorId])
    : new Map<string, string>()

  return {
    conversationId: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    listingId: row.listing.id,
    listingTitle: row.listing.title ?? "Listing",
    listingSlug: row.listing.slug,
    listingCoverUrl: pickCover(row.listing.listing_images),
    buyerName: row.buyer?.display_name ?? "Buyer",
    buyerAvatarUrl: row.buyer?.avatar_url ?? null,
    consignorName: consignorId ? consignorNames.get(consignorId) ?? null : null,
    messages,
  }
}

/** Marks buyer-sent messages on a thread as read (the shop has now seen them). */
export async function markStoreThreadReadByShop(
  conversationId: string,
  ownerProfileId: string,
): Promise<void> {
  const service = createServiceRoleClient()
  await service
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .eq("is_read", false)
    .neq("sender_id", ownerProfileId)
}
