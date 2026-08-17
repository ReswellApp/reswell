import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  isListingExclusiveBuyerWindowActive,
  LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS,
} from "@/lib/services/listingBuyerExclusiveWindow"
import {
  parseOrderExclusiveRepurchaseMessageMetadata,
  type OrderExclusiveRepurchaseMessagePayload,
} from "@/lib/validations/order-exclusive-repurchase-message-metadata"

type OrderExclusiveRepurchaseContext = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
}

function formatExclusiveUntilLabel(untilIso: string): string {
  const until = new Date(untilIso)
  if (Number.isNaN(until.getTime())) return "soon"
  return until.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  })
}

async function exclusiveRepurchaseNotificationAlreadySent(
  supabase: SupabaseClient,
  conversationId: string,
  orderId: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40)

  for (const row of rows ?? []) {
    const parsed = parseOrderExclusiveRepurchaseMessageMetadata(row.metadata)
    if (parsed?.orderId === orderId) return true
  }
  return false
}

function listingTitleSummary(listingTitles: string[]): string {
  const cleaned = listingTitles.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length === 0) return "Item"
  if (cleaned.length === 1) return cleaned[0]!
  return `${cleaned.length} items — ${cleaned.map((t) => `"${t}"`).join(", ")}`
}

async function loadExclusiveRepurchaseListingContext(
  supabase: SupabaseClient,
  order: OrderExclusiveRepurchaseContext,
): Promise<
  | {
      primaryListingId: string
      listingTitles: string[]
      listingSlug: string | null
      listingSection: PeerListingSection
      exclusiveUntil: string
    }
  | null
> {
  const listingIds = new Set<string>()
  if (order.listing_id) listingIds.add(order.listing_id)

  const { data: items } = await supabase
    .from("order_items")
    .select("listing_id")
    .eq("order_id", order.id)

  for (const row of items ?? []) {
    const id = (row as { listing_id?: string | null }).listing_id
    if (typeof id === "string" && id.length > 0) listingIds.add(id)
  }

  const ids = [...listingIds]
  if (ids.length === 0) return null

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, slug, section, exclusive_buyer_id, exclusive_buyer_until, status")
    .in("id", ids)

  const activeExclusive = (listings ?? []).filter((row) => {
    const listing = row as {
      exclusive_buyer_id: string | null
      exclusive_buyer_until: string | null
      status: string
    }
    return (
      listing.status === "active" &&
      listing.exclusive_buyer_id === order.buyer_id &&
      isListingExclusiveBuyerWindowActive(listing)
    )
  })

  if (activeExclusive.length === 0) return null

  const primary =
    activeExclusive.find((row) => (row as { id: string }).id === order.listing_id) ??
    activeExclusive[0]

  const primaryRow = primary as {
    id: string
    title?: string | null
    slug?: string | null
    section?: string | null
    exclusive_buyer_until: string | null
  }
  const sectionRaw = primaryRow.section?.trim() ?? "surfboards"
  const listingSection: PeerListingSection = isPeerListingSection(sectionRaw)
    ? sectionRaw
    : "surfboards"

  const titleById = new Map(
    (listings ?? []).map((row) => [
      (row as { id: string }).id,
      typeof (row as { title?: string }).title === "string"
        ? (row as { title: string }).title.trim() || "Item"
        : "Item",
    ]),
  )

  const exclusiveListingIds = activeExclusive.map((row) => (row as { id: string }).id)
  const listingTitles = exclusiveListingIds.map((id) => titleById.get(id) ?? "Item")

  const until = primaryRow.exclusive_buyer_until?.trim()
  if (!until) return null

  return {
    primaryListingId: primaryRow.id,
    listingTitles,
    listingSlug: primaryRow.slug?.trim() || null,
    listingSection,
    exclusiveUntil: until,
  }
}

function buildExclusiveRepurchasePlainText(params: {
  displayOrderNum: string
  listingTitle: string
  listingTitles: string[]
  exclusiveUntilLabel: string
}): string {
  const titles = params.listingTitles.map((t) => t.trim()).filter(Boolean)
  const itemLine =
    titles.length <= 1
      ? `"${titles[0] ?? params.listingTitle}"`
      : titles.map((t) => `• "${t}"`).join("\n")

  return [
    `Reswell: You can buy this item again.`,
    "",
    `Order #${params.displayOrderNum} was refunded, but the listing is back on Reswell.`,
    "",
    titles.length <= 1 ? `Item: ${itemLine}` : ["Items:", itemLine].join("\n"),
    "",
    `You have exclusive access to purchase through ${params.exclusiveUntilLabel} (${LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS} days). Other buyers cannot check out until then.`,
    "",
    `Tap Buy it now below to checkout.`,
  ].join("\n")
}

export async function postOrderExclusiveRepurchaseThreadNotification(
  supabase: SupabaseClient,
  params: {
    orderId: string
    orderNum: string | null
    buyerId: string
    sellerId: string
    primaryListingId: string
    listingTitles: string[]
    listingSlug: string | null
    listingSection: PeerListingSection
    exclusiveUntil: string
  },
): Promise<void> {
  let conv = await getConversationForBuyerSellerListing(
    supabase,
    params.buyerId,
    params.sellerId,
    params.primaryListingId,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      params.buyerId,
      params.sellerId,
      params.primaryListingId,
    )
    if (!ensured) {
      console.error("[postOrderExclusiveRepurchase] conversation insert failed", {
        orderId: params.orderId,
      })
      return
    }
    conv = { id: ensured.id, listing_id: params.primaryListingId }
  }

  const alreadySent = await exclusiveRepurchaseNotificationAlreadySent(supabase, conv.id, params.orderId)
  if (alreadySent) return

  const displayOrderNum = formatOrderNumForCustomer(params.orderNum, params.orderId)
  const listingTitle = listingTitleSummary(params.listingTitles)
  const exclusiveUntilLabel = formatExclusiveUntilLabel(params.exclusiveUntil)

  const content = buildExclusiveRepurchasePlainText({
    displayOrderNum,
    listingTitle,
    listingTitles: params.listingTitles,
    exclusiveUntilLabel,
  })

  const metadata: OrderExclusiveRepurchaseMessagePayload = {
    kind: "order_exclusive_repurchase",
    orderId: params.orderId,
    orderNum: displayOrderNum,
    listingId: params.primaryListingId,
    listingTitle,
    ...(params.listingTitles.length > 1 ? { listingTitles: params.listingTitles } : {}),
    listingSlug: params.listingSlug,
    listingSection: params.listingSection,
    exclusiveUntil: params.exclusiveUntil,
  }

  const { data: inserted, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: params.sellerId,
      content,
      metadata,
    })
    .select("id, created_at")
    .single()

  if (msgErr || !inserted) {
    console.error("[postOrderExclusiveRepurchase] message insert failed:", msgErr)
    return
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

  try {
    revalidateMessagesInboxForParticipants(params.buyerId, params.sellerId)
  } catch {
    // No-op outside Next.js request context (e.g. scripts).
  }
}

/** Posts the exclusive repurchase follow-up in the buyer↔seller thread when applicable. */
export async function ensureOrderExclusiveRepurchaseThreadNotification(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_num, buyer_id, seller_id, listing_id, status")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    console.error("[ensureOrderExclusiveRepurchase] order load:", error?.message ?? "not found")
    return
  }

  if ((order as { status?: string }).status !== "refunded") {
    return
  }

  const ctx = order as OrderExclusiveRepurchaseContext
  if (!ctx.buyer_id || !ctx.seller_id) {
    console.error("[ensureOrderExclusiveRepurchase] missing buyer or seller", { orderId })
    return
  }

  const loaded = await loadExclusiveRepurchaseListingContext(supabase, ctx)
  if (!loaded) return

  await postOrderExclusiveRepurchaseThreadNotification(supabase, {
    orderId: ctx.id,
    orderNum: ctx.order_num,
    buyerId: ctx.buyer_id,
    sellerId: ctx.seller_id,
    primaryListingId: loaded.primaryListingId,
    listingTitles: loaded.listingTitles,
    listingSlug: loaded.listingSlug,
    listingSection: loaded.listingSection,
    exclusiveUntil: loaded.exclusiveUntil,
  })
}

/** Removes prior exclusive-repurchase follow-ups for an order (service role). */
export async function deleteOrderExclusiveRepurchaseThreadNotifications(
  supabase: SupabaseClient,
  orderId: string,
): Promise<number> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("buyer_id, seller_id, listing_id")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error("[deleteOrderExclusiveRepurchase] order load:", orderErr?.message ?? "not found")
    return 0
  }

  const buyerId = (order as { buyer_id?: string | null }).buyer_id
  const sellerId = (order as { seller_id?: string | null }).seller_id
  const listingId = (order as { listing_id?: string | null }).listing_id
  if (!buyerId || !sellerId || !listingId) return 0

  const conv = await getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId)
  if (!conv) return 0

  const { data: rows, error: listErr } = await supabase
    .from("messages")
    .select("id, metadata, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(60)

  if (listErr) {
    console.error("[deleteOrderExclusiveRepurchase] list messages:", listErr)
    return 0
  }

  const toDelete = (rows ?? [])
    .filter((row) => parseOrderExclusiveRepurchaseMessageMetadata(row.metadata)?.orderId === orderId)
    .map((row) => (row as { id: string }).id)

  if (toDelete.length === 0) return 0

  const { error: delErr } = await supabase.from("messages").delete().in("id", toDelete)
  if (delErr) {
    console.error("[deleteOrderExclusiveRepurchase] delete:", delErr)
    return 0
  }

  const { data: latest } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextLastAt =
    latest?.created_at ??
    (
      await supabase.from("conversations").select("created_at").eq("id", conv.id).maybeSingle()
    ).data?.created_at ??
    new Date().toISOString()

  await supabase
    .from("conversations")
    .update({ last_message_at: nextLastAt })
    .eq("id", conv.id)

  return toDelete.length
}
