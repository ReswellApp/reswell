import {
  mobileCartSchema,
  mobileConversationDetailSchema,
  mobileFavoritesSchema,
  mobileFollowingSchema,
  mobileOffersSchema,
  mobileOrdersSchema,
  mobileReviewsPageSchema,
  mobileSalesSchema,
  type MobileCart,
  type MobileConversationDetail,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFollowing,
  type MobileOffer,
  type MobileOrder,
  type MobileReview,
  type MobileReviewsPage,
  type MobileSale,
} from "@reswell/api-contract"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import {
  listMobileCartRows,
  listMobileFavoriteRows,
  listMobileFollowedSellers,
  listMobileMessageRows,
  listMobileOrderRows,
  listMobileReviewRows,
  type MobileFollowedSellerRow,
  type MobileOrderRow,
} from "@/lib/db/mobile-account"
import { listMobileListingRows, type MobileListingRow } from "@/lib/db/mobile-listings"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { isListingPubliclyVisible, isListingVisibleInSavedList } from "@/lib/listing-public-visibility"
import { redactShippingLabelArtifactsFromMessage } from "@/lib/messages/redact-seller-shipping-label"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { getMessagesInboxForUser } from "@/lib/services/messagesInbox"
import {
  toMobileConversationPreview,
  toMobileOffer,
  toMobileOrder,
  toMobileReview,
  toMobileSale,
} from "@/lib/services/mobileAccountMap"
import {
  loadPublicMobileProfileRow,
  toMobileListingCard,
  type MobileApiResult,
} from "@/lib/services/mobileApi"
import type { SupabaseClient } from "@supabase/supabase-js"

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function cardsFromRows(
  rows: MobileListingRow[],
  visible: (row: MobileListingRow) => boolean,
): ReturnType<typeof toMobileListingCard>[] {
  const cards = []
  for (const row of rows) {
    if (!visible(row)) continue
    const card = toMobileListingCard(row)
    if (card) cards.push(card)
  }
  return cards
}

export async function listMobileProfileListingsService(
  slug: string,
  query: { limit: number; offset: number; status: "current" | "sold" },
): Promise<MobileApiResult<{ listings: NonNullable<ReturnType<typeof toMobileListingCard>>[]; limit: number; offset: number; has_more: boolean }>> {
  const profile = await loadPublicMobileProfileRow(slug)
  if (!profile.ok) return profile

  const listed = await listMobileListingRows({
    limit: query.limit,
    offset: query.offset,
    sellerId: profile.data.id,
    availability: query.status === "sold" ? "sold" : "current",
  })
  if (!listed.ok) {
    console.error("[mobile-api] profile listings failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load listings right now" }
  }

  const listings = cardsFromRows(listed.rows, (row) =>
    query.status === "sold" ? true : isListingPubliclyVisible(row),
  ).filter((card): card is NonNullable<typeof card> => card != null)

  return {
    ok: true,
    data: { listings, limit: query.limit, offset: query.offset, has_more: listed.hasMore },
  }
}

export async function listMobileProfileReviewsService(
  slug: string,
  query: { limit: number; offset: number },
): Promise<MobileApiResult<MobileReviewsPage>> {
  const profile = await loadPublicMobileProfileRow(slug)
  if (!profile.ok) return profile

  const listed = await listMobileReviewRows(profile.data.id, query.limit, query.offset)
  if (!listed.ok) {
    console.error("[mobile-api] reviews failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load reviews right now" }
  }

  const reviews: MobileReview[] = []
  for (const row of listed.rows) {
    const review = toMobileReview(row, profile.data.id)
    if (review) reviews.push(review)
  }
  const page = {
    reviews,
    limit: query.limit,
    offset: query.offset,
    has_more: Boolean(listed.hasMore),
  }
  const parsed = mobileReviewsPageSchema.safeParse(page)
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load reviews right now" }
  return { ok: true, data: parsed.data }
}

export async function listMobileFavoritesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ favorites: MobileFavorite[] }>> {
  const listed = await listMobileFavoriteRows(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load favorites right now" }

  const favorites: MobileFavorite[] = []
  for (const row of listed.rows) {
    if (!row.listing || !isListingVisibleInSavedList(row.listing)) continue
    const listing = toMobileListingCard(row.listing)
    if (!listing) continue
    const parsed = mobileFavoriteSchema.safeParse({ id: row.id, saved_at: row.created_at, listing })
    if (parsed.success) favorites.push(parsed.data)
  }
  const page = mobileFavoritesSchema.safeParse({ favorites })
  if (!page.success) return { ok: false, status: 500, error: "Unable to load favorites right now" }
  return { ok: true, data: page.data }
}

function followedSeller(row: MobileFollowedSellerRow) {
  const slug = text(row.seller_slug)
  if (!slug) return null
  const isShop = Boolean(row.is_shop)
  const avatar = isShop ? text(row.shop_logo_url) ?? text(row.avatar_url) : text(row.avatar_url)
  return {
    id: row.id,
    seller_slug: slug,
    name: (isShop ? text(row.shop_name) ?? text(row.display_name) : text(row.display_name)) ?? "Reswell member",
    avatar_url: avatar ? absoluteProxiedProfileMediaUrl(avatar) ?? null : null,
    city: text(row.city),
    is_shop: isShop,
    verified: isShop && Boolean(row.shop_verified),
  }
}

export async function listMobileFollowingService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileFollowing>> {
  const listed = await listMobileFollowedSellers(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load following right now" }
  const sellers = listed.rows.map(followedSeller).filter((seller) => seller != null)
  const parsed = mobileFollowingSchema.safeParse({ sellers })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load following right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileCartService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileCart>> {
  const listed = await listMobileCartRows(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load your cart right now" }

  const items = []
  for (const row of listed.rows) {
    if (!row.listing || !isListingPubliclyVisible(row.listing)) continue
    const listing = toMobileListingCard(row.listing)
    if (!listing) continue
    const quantity = Math.max(1, Math.floor(Number(row.quantity) || 1))
    items.push({ quantity, listing })
  }
  const parsed = mobileCartSchema.safeParse({ items, item_count: items.reduce((sum, item) => sum + item.quantity, 0) })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your cart right now" }
  return { ok: true, data: parsed.data }
}

export async function listMobileOffersService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ offers: MobileOffer[] }>> {
  const partitioned = await fetchDashboardOffersPartitioned(supabase, userId)
  if (partitioned.fetchError) {
    return { ok: false, status: 500, error: "Unable to load offers right now" }
  }
  const offers: MobileOffer[] = []
  for (const row of partitioned.sent) {
    const offer = toMobileOffer(row, "sent", partitioned.sellersById[row.seller_id])
    if (offer) offers.push(offer)
  }
  for (const row of partitioned.received) {
    const offer = toMobileOffer(row, "received", partitioned.buyersById[row.buyer_id])
    if (offer) offers.push(offer)
  }
  const parsed = mobileOffersSchema.safeParse({ offers })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load offers right now" }
  return { ok: true, data: parsed.data }
}

async function listOrders(
  supabase: SupabaseClient,
  userId: string,
  role: "buyer" | "seller",
): Promise<MobileOrderRow[] | MobileApiResult<never>> {
  const listed = await listMobileOrderRows(supabase, userId, role)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load orders right now" }
  return listed.rows
}

export async function listMobilePurchasesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ orders: MobileOrder[] }>> {
  const rows = await listOrders(supabase, userId, "buyer")
  if (!Array.isArray(rows)) return rows
  const orders = rows.map(toMobileOrder).filter((order): order is MobileOrder => order != null)
  const parsed = mobileOrdersSchema.safeParse({ orders })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load orders right now" }
  return { ok: true, data: parsed.data }
}

export async function listMobileSalesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ sales: MobileSale[] }>> {
  const rows = await listOrders(supabase, userId, "seller")
  if (!Array.isArray(rows)) return rows
  const sales = rows.map(toMobileSale).filter((sale): sale is MobileSale => sale != null)
  const parsed = mobileSalesSchema.safeParse({ sales })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load sales right now" }
  return { ok: true, data: parsed.data }
}

export async function listMobileConversationsService(
  userId: string,
): Promise<MobileApiResult<{ conversations: MobileConversationPreview[] }>> {
  const inbox = await getMessagesInboxForUser(userId)
  const conversations: MobileConversationPreview[] = []
  for (const row of inbox.conversations) {
    const preview = toMobileConversationPreview(row, userId)
    if (preview) conversations.push(preview)
  }
  return { ok: true, data: { conversations } }
}

export async function getMobileConversationService(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<MobileApiResult<MobileConversationDetail>> {
  const allowed = await userParticipatesInConversation(supabase, userId, conversationId)
  if (!allowed) return { ok: false, status: 404, error: "Conversation not found" }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      listing_id,
      buyer_id,
      seller_id,
      listing:listings ( title ),
      buyer:profiles!conversations_buyer_id_fkey ( display_name ),
      seller:profiles!conversations_seller_id_fkey ( display_name )
    `,
    )
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !conversation) return { ok: false, status: 500, error: "Unable to load messages right now" }

  const listed = await listMobileMessageRows(supabase, conversationId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load messages right now" }

  const header = conversation as {
    id: string
    listing_id: string | null
    buyer_id: string
    seller_id: string
    listing: { title?: string | null } | { title?: string | null }[] | null
    buyer: { display_name?: string | null } | { display_name?: string | null }[] | null
    seller: { display_name?: string | null } | { display_name?: string | null }[] | null
  }
  const other = header.buyer_id === userId ? oneProfile(header.seller) : oneProfile(header.buyer)
  const listing = Array.isArray(header.listing) ? header.listing[0] : header.listing
  const messages = listed.rows.map((row) => {
    const redacted = redactShippingLabelArtifactsFromMessage(row)
    return {
      id: row.id,
      body: text(typeof redacted.content === "string" ? redacted.content : row.content) ?? "",
      created_at: row.created_at,
      mine: row.sender_id === userId,
    }
  })

  const parsed = mobileConversationDetailSchema.safeParse({
    id: header.id,
    listing_id: header.listing_id,
    listing_title: text(listing?.title),
    other_name: getPublicSellerDisplayName(other),
    messages,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load messages right now" }
  return { ok: true, data: parsed.data }
}

function oneProfile(
  value: { display_name?: string | null } | { display_name?: string | null }[] | null,
): { display_name?: string | null } | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}
