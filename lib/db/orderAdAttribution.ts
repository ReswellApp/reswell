import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyAdChannel,
  snapshotHasAdSignal,
  type AdAttributionSnapshot,
} from "@/lib/ads/attribution"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"

export type OrderAdAttributionRow = {
  orderId: string
  channel: ReturnType<typeof classifyAdChannel>
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  fbclid: string | null
  landingPath: string | null
  landingListingId: string | null
  capturedAt: string | null
  createdAt: string
  orderNum: string | null
  orderStatus: string
  orderAmount: number
  orderCreatedAt: string
  listingId: string
  itemPrice: number
  quantity: number
}

export async function insertOrderAdAttribution(
  supabase: SupabaseClient,
  orderId: string,
  snapshot: AdAttributionSnapshot | null,
): Promise<void> {
  if (!snapshot || !snapshotHasAdSignal(snapshot)) return
  const channel = classifyAdChannel(snapshot)
  if (channel === "other") return

  const { error } = await supabase.from("order_ad_attribution").upsert(
    {
      order_id: orderId,
      channel,
      utm_source: snapshot.source,
      utm_medium: snapshot.medium,
      utm_campaign: snapshot.campaign,
      utm_content: snapshot.content,
      utm_term: snapshot.term,
      gclid: snapshot.gclid,
      gbraid: snapshot.gbraid,
      wbraid: snapshot.wbraid,
      fbclid: snapshot.fbclid,
      landing_path: snapshot.landingPath,
      landing_listing_id: snapshot.landingListingId && snapshot.landingListingId.length === 36
        ? snapshot.landingListingId
        : null,
      captured_at: snapshot.capturedAt,
    },
    { onConflict: "order_id" },
  )
  if (error) {
    console.error("[orderAdAttribution] insert:", error.message)
  }
}

type RawOrderJoin = {
  id: string
  order_num: string | null
  status: string
  amount: number | string
  created_at: string
  listing_id: string
  is_admin_test: boolean | null
  order_ad_attribution:
    | {
        channel: string
        utm_source: string | null
        utm_medium: string | null
        utm_campaign: string | null
        utm_content: string | null
        utm_term: string | null
        gclid: string | null
        gbraid: string | null
        wbraid: string | null
        fbclid: string | null
        landing_path: string | null
        landing_listing_id: string | null
        captured_at: string | null
        created_at: string
      }
    | Array<{
        channel: string
        utm_source: string | null
        utm_medium: string | null
        utm_campaign: string | null
        utm_content: string | null
        utm_term: string | null
        gclid: string | null
        gbraid: string | null
        wbraid: string | null
        fbclid: string | null
        landing_path: string | null
        landing_listing_id: string | null
        captured_at: string | null
        created_at: string
      }>
    | null
  order_items:
    | Array<{
        listing_id: string
        item_price: number | string | null
        quantity: number | null
      }>
    | null
}

function asNumber(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  return Number.isFinite(n) ? n : 0
}

export async function fetchFirstPartyAdAttributedSales(options: {
  sinceIso: string
  untilIso: string
}): Promise<OrderAdAttributionRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      status,
      amount,
      created_at,
      listing_id,
      is_admin_test,
      order_ad_attribution!inner (
        channel,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        gclid,
        gbraid,
        wbraid,
        fbclid,
        landing_path,
        landing_listing_id,
        captured_at,
        created_at
      ),
      order_items (
        listing_id,
        item_price,
        quantity
      )
    `,
    )
    .gte("created_at", options.sinceIso)
    .lte("created_at", options.untilIso)
    .eq("is_admin_test", REAL_MARKETPLACE_SALES_FILTER.is_admin_test)
    .order("created_at", { ascending: false })
    .limit(5000)

  if (error) {
    console.error("[orderAdAttribution] fetch:", error.message)
    return []
  }

  const rows: OrderAdAttributionRow[] = []
  for (const raw of (data ?? []) as unknown as RawOrderJoin[]) {
    const attrRaw = raw.order_ad_attribution
    const attr = Array.isArray(attrRaw) ? attrRaw[0] : attrRaw
    if (!attr) continue
    const channel = attr.channel
    if (channel !== "google_ads" && channel !== "meta_ads" && channel !== "meta_referral") continue

    const items =
      raw.order_items && raw.order_items.length > 0
        ? raw.order_items
        : [{ listing_id: raw.listing_id, item_price: raw.amount, quantity: 1 }]

    for (const item of items) {
      const listingId = typeof item.listing_id === "string" ? item.listing_id : raw.listing_id
      if (!listingId) continue
      rows.push({
        orderId: raw.id,
        channel,
        utmSource: attr.utm_source,
        utmMedium: attr.utm_medium,
        utmCampaign: attr.utm_campaign,
        utmContent: attr.utm_content,
        utmTerm: attr.utm_term,
        gclid: attr.gclid,
        gbraid: attr.gbraid,
        wbraid: attr.wbraid,
        fbclid: attr.fbclid,
        landingPath: attr.landing_path,
        landingListingId: attr.landing_listing_id,
        capturedAt: attr.captured_at,
        createdAt: attr.created_at,
        orderNum: raw.order_num,
        orderStatus: raw.status,
        orderAmount: asNumber(raw.amount),
        orderCreatedAt: raw.created_at,
        listingId,
        itemPrice: asNumber(item.item_price) || asNumber(raw.amount),
        quantity: Math.max(1, Math.floor(asNumber(item.quantity) || 1)),
      })
    }
  }
  return rows
}
