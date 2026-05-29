import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbCountAllShippingLabels,
  dbGetOrderShippingAmounts,
  dbGetRecentShippingLabelsForStats,
  type AdminShippingLabelSource,
} from "@/lib/db/adminOrderShippingLabels"
import {
  dbGetShippingLabelFailureStats,
  type OrderShippingLabelFailureStage,
} from "@/lib/db/orderShippingLabelFailures"

const STATS_WINDOW_DAYS = 30
const STATS_ROW_CAP = 5000
const TOP_CARRIERS = 6

export type AdminShippingStats = {
  windowDays: number
  totals: {
    labelsAllTime: number
    labelsInWindow: number
    spendInWindowUsd: number
    openFailures: number
    resolvedFailures: number
    dismissedFailures: number
  }
  sourceCounts: Record<AdminShippingLabelSource, number>
  carrierCounts: { carrier: string; count: number }[]
  dailySeries: { date: string; count: number; spendUsd: number }[]
  failureStageCounts: Record<OrderShippingLabelFailureStage, number>
  cost: {
    labelsWithCost: number
    totalLabelSpendUsd: number
    reconciledOrders: number
    buyerPaidTotalUsd: number
    /** buyerPaidTotalUsd - totalLabelSpendUsd across reconciled orders. */
    marginUsd: number
  }
}

export type AdminShippingStatsResult =
  | { ok: true; data: AdminShippingStats }
  | { ok: false; message: string; status: number }

function getServiceOrNull(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Aggregated KPIs, time-series, carrier mix, failure funnel, and cost reconciliation. */
export async function getAdminShippingStats(): Promise<AdminShippingStatsResult> {
  const supabase = getServiceOrNull()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const since = new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const [allTime, recent, failures] = await Promise.all([
    dbCountAllShippingLabels(supabase),
    dbGetRecentShippingLabelsForStats(supabase, { sinceIso, cap: STATS_ROW_CAP }),
    dbGetShippingLabelFailureStats(supabase),
  ])

  if (recent.error) {
    console.error("[admin shipping stats] labels:", recent.error)
    return { ok: false, message: "Could not load shipping stats", status: 500 }
  }

  const sourceCounts: Record<AdminShippingLabelSource, number> = {
    shipengine_checkout_lane: 0,
    manual_label_upload: 0,
    manual_tracking_buyer: 0,
  }
  const carrierMap = new Map<string, number>()

  const dayMap = new Map<string, { count: number; spendUsd: number }>()
  for (let i = 0; i < STATS_WINDOW_DAYS; i += 1) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000)
    dayMap.set(d.toISOString().slice(0, 10), { count: 0, spendUsd: 0 })
  }

  let spendInWindow = 0
  const labelOrderIds: string[] = []
  const costByOrder = new Map<string, number>()

  for (const row of recent.data) {
    if (row.source in sourceCounts) sourceCounts[row.source] += 1

    const carrier = row.tracking_carrier?.trim() || "Unknown"
    carrierMap.set(carrier, (carrierMap.get(carrier) ?? 0) + 1)

    const cost = typeof row.label_cost_usd === "number" ? row.label_cost_usd : Number(row.label_cost_usd)
    const costVal = Number.isFinite(cost) ? cost : 0
    if (costVal > 0) {
      spendInWindow += costVal
      labelOrderIds.push(row.order_id)
      costByOrder.set(row.order_id, (costByOrder.get(row.order_id) ?? 0) + costVal)
    }

    const key = dayKey(row.created_at)
    const bucket = dayMap.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.spendUsd += costVal
    }
  }

  const carrierCounts = [...carrierMap.entries()]
    .map(([carrier, count]) => ({ carrier, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CARRIERS)

  const dailySeries = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, count: v.count, spendUsd: round2(v.spendUsd) }))

  // Cost reconciliation: buyer-paid shipping vs what Reswell paid the carrier.
  const { data: buyerPaidMap, error: amountsErr } = await dbGetOrderShippingAmounts(
    supabase,
    labelOrderIds,
  )
  if (amountsErr) {
    console.error("[admin shipping stats] order amounts:", amountsErr)
  }

  let buyerPaidTotal = 0
  let reconciledLabelSpend = 0
  let reconciledOrders = 0
  for (const [orderId, labelCost] of costByOrder.entries()) {
    const paid = buyerPaidMap.get(orderId)
    if (paid != null) {
      buyerPaidTotal += paid
      reconciledLabelSpend += labelCost
      reconciledOrders += 1
    }
  }

  return {
    ok: true,
    data: {
      windowDays: STATS_WINDOW_DAYS,
      totals: {
        labelsAllTime: allTime.count,
        labelsInWindow: recent.data.length,
        spendInWindowUsd: round2(spendInWindow),
        openFailures: failures.data.open,
        resolvedFailures: failures.data.resolved,
        dismissedFailures: failures.data.dismissed,
      },
      sourceCounts,
      carrierCounts,
      dailySeries,
      failureStageCounts: failures.data.openByStage,
      cost: {
        labelsWithCost: costByOrder.size,
        totalLabelSpendUsd: round2(spendInWindow),
        reconciledOrders,
        buyerPaidTotalUsd: round2(buyerPaidTotal),
        marginUsd: round2(buyerPaidTotal - reconciledLabelSpend),
      },
    },
  }
}
