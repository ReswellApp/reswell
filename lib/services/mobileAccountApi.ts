import {
  mobileCartSchema,
  mobileConversationDetailSchema,
  mobileDashboardSchema,
  mobileFavoriteSchema,
  mobileFavoritesSchema,
  mobileFollowersSchema,
  mobileFollowingSchema,
  mobileOffersSchema,
  mobileReviewsPageSchema,
  type MobileCart,
  type MobileConversationDetail,
  type MobileDashboard,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFollowing,
  type MobileOffer,
  type MobileReview,
  type MobileReviewsPage,
} from "@reswell/api-contract"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import {
  composeMediaAttachmentMessageBody,
  parseMarketplaceMessageImageAttachment,
  parseMarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"
import {
  fetchMobileDashboardAccess,
  fetchMobileDashboardFacts,
  listMobileCartRows,
  listMobileFavoriteRows,
  listMobileFollowedSellers,
  listMobileFollowers,
  listMobileMessageRows,
  listMobileReviewRows,
  type MobileFollowedSellerRow,
} from "@/lib/db/mobile-account"
import { listMobileListingRows, type MobileListingRow } from "@/lib/db/mobile-listings"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { getSellerReviewSummary } from "@/lib/db/seller-reviews"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { parseOrderPlacedMessageMetadata } from "@/lib/validations/order-placed-message-metadata"
import { isListingPubliclyVisible, isListingVisibleInSavedList } from "@/lib/listing-public-visibility"
import { redactShippingLabelArtifactsFromMessage } from "@/lib/messages/redact-seller-shipping-label"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import { getMessagesInboxForUser, markMarketplaceConversationRead } from "@/lib/services/messagesInbox"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { resolveProfileShopSectionFilter } from "@/lib/sellers/profile-shop-section-filter"
import {
  toMobileConversationPreview,
  toMobileOfferForUser,
  toMobileReview,
} from "@/lib/services/mobileAccountMap"
import {
  getMobileMeService,
  getMobileProfileService,
  loadPublicMobileProfileRow,
  toMobileListingCard,
  type MobileApiResult,
} from "@/lib/services/mobileApi"
import { getMySellerEarningsTotals } from "@/lib/db/sellerEarningsTotals"
import { mobileDashboardPages } from "@/lib/services/mobileDashboardPages"
import type { SupabaseClient, User } from "@supabase/supabase-js"

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
  query: {
    limit: number
    offset: number
    status: "current" | "sold"
    section?: string
    q?: string
  },
): Promise<MobileApiResult<{ listings: NonNullable<ReturnType<typeof toMobileListingCard>>[]; limit: number; offset: number; has_more: boolean }>> {
  const profile = await loadPublicMobileProfileRow(slug)
  if (!profile.ok) return profile

  const section = resolveProfileShopSectionFilter(query.section)
  if (query.section?.trim() && !section) {
    return { ok: false, status: 400, error: "Invalid shop category" }
  }

  const listed = await listMobileListingRows({
    limit: query.limit,
    offset: query.offset,
    sellerId: profile.data.id,
    availability: query.status === "sold" ? "sold" : "current",
    section,
    q: query.q,
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

export async function listMobileReviewsForUserService(
  userId: string,
  query: { limit: number; offset: number },
): Promise<MobileApiResult<MobileReviewsPage>> {
  const listed = await listMobileReviewRows(userId, query.limit, query.offset)
  if (!listed.ok) {
    console.error("[mobile-api] reviews failed", {
      timestamp: new Date().toISOString(),
      message: listed.message,
    })
    return { ok: false, status: 500, error: "Unable to load reviews right now" }
  }

  const reviews: MobileReview[] = []
  for (const row of listed.rows) {
    const review = toMobileReview(row, userId)
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

export async function listMobileProfileReviewsService(
  slug: string,
  query: { limit: number; offset: number },
): Promise<MobileApiResult<MobileReviewsPage>> {
  const profile = await loadPublicMobileProfileRow(slug)
  if (!profile.ok) return profile
  return listMobileReviewsForUserService(profile.data.id, query)
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
    avatar_url: absoluteProfileCircleUrl(avatar),
    city: text(row.city),
    is_shop: isShop,
    verified: isShop && Boolean(row.shop_verified),
  }
}

export async function listMobileFollowersService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileFollowing>> {
  const listed = await listMobileFollowers(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load followers right now" }
  const sellers = listed.rows.map(followedSeller).filter((seller) => seller != null)
  const parsed = mobileFollowersSchema.safeParse({ sellers })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load followers right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileDashboardService(
  supabase: SupabaseClient,
  user: User,
): Promise<MobileApiResult<MobileDashboard>> {
  const [me, facts, earnings, access] = await Promise.all([
    getMobileMeService(supabase, user),
    fetchMobileDashboardFacts(supabase, user.id),
    getMySellerEarningsTotals(supabase),
    fetchMobileDashboardAccess(supabase, user.id),
  ])
  if (!me.ok) return me
  if (!facts.ok || !access.ok) return { ok: false, status: 500, error: "Unable to load your dashboard right now" }

  const slug = me.data.seller_slug
  const profile = slug ? await getMobileProfileService(slug, { supabase, userId: user.id }) : null
  if (profile && !profile.ok && profile.status !== 404) return profile

  const publicProfile = profile && profile.ok ? profile.data : null
  const lifetime = earnings?.lifetimeSoldUsd ?? 0
  const wallet = facts.rows.wallet_balance_usd
  const dashboard = {
    id: me.data.id,
    email: me.data.email,
    display_name: publicProfile?.name ?? me.data.display_name,
    seller_slug: me.data.seller_slug,
    avatar_url: publicProfile?.avatar_url ?? me.data.avatar_url,
    about: publicProfile?.about ?? null,
    website_url: publicProfile?.website_url ?? null,
    follower_count: publicProfile?.follower_count ?? 0,
    following_count: facts.rows.following_count,
    review_count: publicProfile?.review_count ?? 0,
    rating_average: publicProfile?.rating_average ?? 0,
    active_listing_count: publicProfile?.listing_count ?? facts.rows.active_listing_count,
    sold_count: facts.rows.sale_count,
    purchase_count: facts.rows.purchase_count,
    favorite_count: facts.rows.favorite_count,
    pending_offer_count: facts.rows.pending_offer_count,
    unread_message_count: facts.rows.unread_message_count,
    earnings_lifetime_usd: lifetime,
    earnings_lifetime_label: money(lifetime),
    wallet_balance_usd: wallet,
    wallet_balance_label: money(wallet),
    pages: mobileDashboardPages(access.rows),
  }
  const parsed = mobileDashboardSchema.safeParse(dashboard)
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your dashboard right now" }
  return { ok: true, data: parsed.data }
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
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
  for (const row of [...partitioned.sent, ...partitioned.received]) {
    const offer = toMobileOfferForUser(row, userId, partitioned.sellersById, partitioned.buyersById)
    if (offer) offers.push(offer)
  }
  const parsed = mobileOffersSchema.safeParse({ offers })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load offers right now" }
  return { ok: true, data: parsed.data }
}

export { listMobilePurchasesService } from "@/lib/services/mobilePurchases"
export {
  getMobileSaleDetailService,
  listMobileSalesService,
} from "@/lib/services/mobileSales"

export async function listMobileConversationsService(
  userId: string,
): Promise<MobileApiResult<{ conversations: MobileConversationPreview[] }>> {
  const inbox = await getMessagesInboxForUser(userId)
  const conversations: MobileConversationPreview[] = []
  for (const row of inbox.conversations) {
    const preview = toMobileConversationPreview(row, userId)
    if (preview) conversations.push(preview)
  }
  conversations.sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at))
  return { ok: true, data: { conversations } }
}

export async function getMobileConversationService(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<MobileApiResult<MobileConversationDetail>> {
  const allowed = await userParticipatesInConversation(supabase, userId, conversationId)
  if (!allowed) return { ok: false, status: 404, error: "Conversation not found" }

  const readPromise = markMarketplaceConversationRead(userId, conversationId).catch((error: unknown) => {
    console.warn("[mobile conversation] mark read skipped", error)
    return { ok: false as const, error: "Failed to mark read" }
  })

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      listing_id,
      buyer_id,
      seller_id,
      listing:listings ( title, slug, primary_image_url, primary_thumbnail_url ),
      buyer:profiles!conversations_buyer_id_fkey ( display_name, avatar_url, created_at ),
      seller:profiles!conversations_seller_id_fkey ( display_name, avatar_url, created_at )
    `,
    )
    .eq("id", conversationId)
    .maybeSingle()

  const marked = await readPromise
  if (marked.ok) {
    revalidateMessagesInboxForParticipants(marked.buyerId, marked.sellerId)
  }

  if (error || !conversation) return { ok: false, status: 500, error: "Unable to load messages right now" }

  const header = conversation as {
    id: string
    listing_id: string | null
    buyer_id: string
    seller_id: string
    listing:
      | { title?: string | null; slug?: string | null; primary_image_url?: string | null; primary_thumbnail_url?: string | null }
      | { title?: string | null; slug?: string | null; primary_image_url?: string | null; primary_thumbnail_url?: string | null }[]
      | null
    buyer: ThreadProfile | ThreadProfile[] | null
    seller: ThreadProfile | ThreadProfile[] | null
  }
  const viewerIsSeller = header.seller_id === userId
  const otherId = viewerIsSeller ? header.buyer_id : header.seller_id
  const [listed, reviews] = await Promise.all([
    listMobileMessageRows(supabase, conversationId),
    getSellerReviewSummary(supabase, otherId),
  ])
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load messages right now" }

  const other = viewerIsSeller ? oneProfile(header.buyer) : oneProfile(header.seller)
  const listing = Array.isArray(header.listing) ? header.listing[0] : header.listing
  const avatar = text(other?.avatar_url)
  const listingImage = text(listing?.primary_thumbnail_url) ?? text(listing?.primary_image_url)
  const messages = listed.rows.map((row) => {
    const redacted = redactShippingLabelArtifactsFromMessage(row)
    const order = orderCard(row.metadata, viewerIsSeller)
    const imageAtt = parseMarketplaceMessageImageAttachment(row.metadata)
    const videoAtt = parseMarketplaceMessageVideoAttachment(row.metadata)
    const attachment = imageAtt ? ({ kind: "image" as const } ) : videoAtt ? ({ kind: "video" as const }) : null
    const rawBody = order ? "" : text(typeof redacted.content === "string" ? redacted.content : row.content) ?? ""
    const placeholder =
      attachment?.kind === "image"
        ? composeMediaAttachmentMessageBody("image")
        : attachment?.kind === "video"
          ? composeMediaAttachmentMessageBody("video")
          : null
    const body = attachment && rawBody === placeholder ? "" : rawBody
    return {
      id: row.id,
      body,
      created_at: row.created_at,
      mine: row.sender_id === userId,
      order,
      attachment,
    }
  })

  const parsed = mobileConversationDetailSchema.safeParse({
    id: header.id,
    listing_id: header.listing_id,
    listing_slug: text(listing?.slug),
    listing_title: text(listing?.title),
    listing_image_url: listingImage ? absolutePublicMediaUrl(listingImage) ?? null : null,
    other_name: getPublicSellerDisplayName(other),
    other_avatar_url: absoluteProfileCircleUrl(avatar),
    other_joined_label: joinedLabel(other?.created_at),
    other_review_count: reviews.data.reviewCount,
    other_rating_average: reviews.data.reviewCount > 0 ? reviews.data.avgRating : null,
    viewer_is_seller: viewerIsSeller,
    messages,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load messages right now" }
  return { ok: true, data: parsed.data }
}

type ThreadProfile = {
  display_name?: string | null
  avatar_url?: string | null
  created_at?: string | null
}

function oneProfile(value: ThreadProfile | ThreadProfile[] | null): ThreadProfile | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function joinedLabel(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return `Joined ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
}

function orderCard(metadata: unknown, viewerIsSeller: boolean) {
  const order = parseOrderPlacedMessageMetadata(metadata)
  if (!order) return null
  const items = (order.listingTitles?.length ? order.listingTitles : [order.listingTitle])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
  if (items.length === 0) return null
  const payment =
    order.paymentMethod === "reswell_bucks" ? "Wallet" : order.paymentMethod === "cash" ? "Cash" : "Card"
  const shipping = order.fulfillment === "shipping"
  return {
    order_id: order.orderId,
    order_num: order.orderNum,
    total_label: `$${order.total.toFixed(2)}`,
    items,
    payment_label: `Paid with ${payment}`,
    fulfillment_label: shipping ? "Shipping" : "Local pickup",
    hint: shipping
      ? viewerIsSeller
        ? "The ship-to address is on the sale. Mark it shipped from Sales when you send it."
        : "Track it from Purchases once the seller ships."
      : "Reply here to set a pickup time.",
  }
}
