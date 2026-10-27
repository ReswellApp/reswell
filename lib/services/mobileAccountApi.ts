import {
  mobileCartSchema,
  mobileConversationDetailSchema,
  mobileDashboardSchema,
  mobileFavoriteSchema,
  mobileFavoritesSchema,
  mobileFollowersSchema,
  mobileFollowingSchema,
  mobileOffersSchema,
  mobileOrdersSchema,
  mobileReviewsPageSchema,
  mobileSaleDetailSchema,
  mobileSalesSchema,
  type MobileCart,
  type MobileConversationDetail,
  type MobileDashboard,
  type MobileConversationPreview,
  type MobileFavorite,
  type MobileFollowing,
  type MobileOffer,
  type MobileOrder,
  type MobileReview,
  type MobileReviewsPage,
  type MobileSale,
  type MobileSaleDetail,
} from "@reswell/api-contract"
import { getConversationForBuyerSellerListing, userParticipatesInConversation } from "@/lib/db/conversations"
import {
  fetchMobileDashboardAccess,
  fetchMobileDashboardFacts,
  listMobileCartRows,
  listMobileFavoriteRows,
  listMobileFollowedSellers,
  listMobileFollowers,
  listMobileMessageRows,
  getMobileSaleDetailRow,
  listMobileOrderRows,
  listMobileReviewRows,
  type MobileFollowedSellerRow,
  type MobileOrderRow,
} from "@/lib/db/mobile-account"
import { listMobileListingRows, type MobileListingRow } from "@/lib/db/mobile-listings"
import { fetchDashboardOffersPartitioned } from "@/lib/db/offers-dashboard"
import { getSellerReviewSummary } from "@/lib/db/seller-reviews"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { parseOrderPlacedMessageMetadata } from "@/lib/validations/order-placed-message-metadata"
import { mobileSaleHasLabel } from "@/lib/services/mobileSaleLabel"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { isListingPubliclyVisible, isListingVisibleInSavedList } from "@/lib/listing-public-visibility"
import { redactShippingLabelArtifactsFromMessage } from "@/lib/messages/redact-seller-shipping-label"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import { getMessagesInboxForUser } from "@/lib/services/messagesInbox"
import { resolveProfileShopSectionFilter } from "@/lib/sellers/profile-shop-section-filter"
import {
  toMobileConversationPreview,
  toMobileOffer,
  toMobileOrder,
  toMobileReview,
  toMobileSale,
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

export async function getMobileSaleDetailService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<MobileApiResult<MobileSaleDetail>> {
  const loaded = await getMobileSaleDetailRow(supabase, userId, orderId)
  if (!loaded.ok) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  if (!loaded.rows) return { ok: false, status: 404, error: "Sale not found" }

  const sale = toMobileSale(loaded.rows)
  if (!sale) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  const amounts = resolveSellerOrderDisplayAmounts({
    amount: loaded.rows.amount ?? 0,
    shipping_amount: loaded.rows.shipping_amount,
    platform_fee: loaded.rows.platform_fee,
    seller_earnings: loaded.rows.seller_earnings ?? 0,
    promo_discount_usd: loaded.rows.promo_discount_usd,
  })
  const [conversation, labelAvailable] = await Promise.all([
    getConversationForBuyerSellerListing(
    supabase,
    loaded.rows.buyer_id,
    userId,
    sale.listing_id,
    ),
    mobileSaleHasLabel(supabase, userId, orderId, loaded.rows.tracking_number),
  ])
  const created = new Date(loaded.rows.created_at)
  const parsed = mobileSaleDetailSchema.safeParse({
    ...sale,
    created_label: Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    buyer_paid_label: moneyLabel(amounts.buyerPaidTotal),
    shipping_label: moneyLabel(amounts.shippingAmount),
    fee_label: moneyLabel(amounts.platformFee),
    ship_to: loaded.rows.ship_to,
    tracking_carrier: loaded.rows.tracking_carrier,
    payout_status: loaded.rows.payout_status,
    conversation_id: conversation?.id ?? null,
    listing_slug: loaded.rows.listing_slug,
    label_available: labelAvailable,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  return { ok: true, data: parsed.data }
}

function moneyLabel(amount: number): string {
  return `$${amount.toFixed(2)}`
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
      listing:listings ( title, slug, primary_image_url, primary_thumbnail_url ),
      buyer:profiles!conversations_buyer_id_fkey ( display_name, avatar_url, created_at ),
      seller:profiles!conversations_seller_id_fkey ( display_name, avatar_url, created_at )
    `,
    )
    .eq("id", conversationId)
    .maybeSingle()

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
    return {
      id: row.id,
      body: order ? "" : text(typeof redacted.content === "string" ? redacted.content : row.content) ?? "",
      created_at: row.created_at,
      mine: row.sender_id === userId,
      order,
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
