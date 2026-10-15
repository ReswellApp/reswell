import type { SupabaseClient } from "@supabase/supabase-js"
import { getSellerEmailForKlaviyo } from "@/lib/klaviyo/seller-sale-event-helpers"
import { trackKlaviyoShippingAdjustment } from "@/lib/klaviyo/track-shipping-adjustment"
import type { ShippingAdjustmentCoverage } from "@/lib/shipping/adjustment-strike"

type UnnotifiedAdjustment = {
  id: string
  order_id: string
  adjustment_amount_usd: number | string
  earnings_deducted_usd: number | string | null
  coverage: string
  tracking_number: string | null
  actual_length: number | string | null
  actual_width: number | string | null
  actual_height: number | string | null
}

type OrderEmbed = {
  id: string
  order_num: string | null
  seller_id: string
  listings: { title: string | null } | { title: string | null }[] | null
}

function finite(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function listingTitle(listings: OrderEmbed["listings"]): string {
  const row = Array.isArray(listings) ? listings[0] : listings
  const title = row?.title?.trim()
  return title || "your item"
}

function isCoverage(value: string): value is ShippingAdjustmentCoverage {
  return value === "covered_strike" || value === "charged_to_earnings"
}

/**
 * Emails sellers about carrier adjustments that have been classified and not
 * yet sent. A Klaviyo miss leaves seller_notified_at empty so the next run retries.
 */
export async function notifySellerShippingAdjustments(
  supabase: SupabaseClient,
): Promise<{ notified: number; failed: number }> {
  const { data, error } = await supabase
    .from("shipengine_label_adjustments")
    .select(
      "id, order_id, adjustment_amount_usd, earnings_deducted_usd, coverage, tracking_number, actual_length, actual_width, actual_height",
    )
    .is("seller_notified_at", null)
    .in("coverage", ["covered_strike", "charged_to_earnings"])
    .not("order_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(40)

  if (error) {
    console.error("[notifySellerShippingAdjustments] list", error.message)
    return { notified: 0, failed: 0 }
  }

  const rows = (data ?? []) as UnnotifiedAdjustment[]
  if (rows.length === 0) return { notified: 0, failed: 0 }

  const orderIds = [...new Set(rows.map((row) => row.order_id))]
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id, order_num, seller_id, listings ( title )")
    .in("id", orderIds)

  if (orderError) {
    console.error("[notifySellerShippingAdjustments] orders", orderError.message)
    return { notified: 0, failed: rows.length }
  }

  const orderById = new Map((orders ?? []).map((order) => [order.id as string, order as OrderEmbed]))
  let notified = 0
  let failed = 0

  for (const row of rows) {
    if (!isCoverage(row.coverage)) continue
    const order = orderById.get(row.order_id)
    if (!order?.seller_id) {
      failed += 1
      continue
    }
    const amountUsd = finite(row.adjustment_amount_usd) ?? 0
    if (amountUsd <= 0) continue
    const sellerEmail = await getSellerEmailForKlaviyo(order.seller_id)
    const sent = await trackKlaviyoShippingAdjustment({
      sellerUserId: order.seller_id,
      sellerEmail,
      orderId: order.id,
      orderNum: order.order_num,
      listingTitle: listingTitle(order.listings),
      adjustmentId: row.id,
      coverage: row.coverage,
      amountUsd,
      earningsDeductedUsd: finite(row.earnings_deducted_usd) ?? 0,
      trackingNumber: row.tracking_number,
      lengthIn: finite(row.actual_length),
      widthIn: finite(row.actual_width),
      heightIn: finite(row.actual_height),
    })
    if (!sent) {
      failed += 1
      continue
    }
    const marked = await supabase
      .from("shipengine_label_adjustments")
      .update({ seller_notified_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("seller_notified_at", null)
    if (marked.error) {
      console.error("[notifySellerShippingAdjustments] mark", row.id, marked.error.message)
      failed += 1
      continue
    }
    notified += 1
  }

  return { notified, failed }
}
