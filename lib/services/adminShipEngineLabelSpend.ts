import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbListLabelAdjustmentsInRange,
  dbMatchTrackingToOrders,
} from "@/lib/db/shipengineLabelSpend"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  chargeUsdForPurchasedLabel,
  listPurchasedShipEngineLabels,
} from "@/lib/shipengine/list-purchased-labels"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import {
  buildLabelSpendTotals,
  kindForPurchasedLabel,
  resolveLabelSpendDateRange,
  roundMoney,
  type AdminShipEngineLabelSpendTotals,
  type LabelSpendKind,
} from "@/lib/shipping/label-spend-math"
import { businessDayKeyFromMs, BUSINESS_TIMEZONE_LABEL } from "@/lib/utils/business-timezone"

export type {
  AdminShipEngineLabelSpendTotals,
  LabelSpendKind,
} from "@/lib/shipping/label-spend-math"
export {
  buildLabelSpendTotals,
  defaultLabelSpendDateRange,
  kindForPurchasedLabel,
  resolveLabelSpendDateRange,
  roundMoney,
} from "@/lib/shipping/label-spend-math"

export type AdminShipEngineLabelSpendRow = {
  labelId: string
  createdAt: string
  trackingNumber: string | null
  carrierCode: string | null
  serviceCode: string | null
  voided: boolean
  isReturnLabel: boolean
  kind: LabelSpendKind
  postageUsd: number
  insuranceUsd: number
  chargeUsd: number
  orderId: string | null
  orderDisplayNum: string | null
}

export type AdminShipEngineLabelSpendDaily = {
  date: string
  count: number
  transferUsd: number
}

export type AdminShipEngineLabelSpend = {
  timezoneLabel: string
  range: { dateFrom: string; dateTo: string }
  totals: AdminShipEngineLabelSpendTotals
  dailySeries: AdminShipEngineLabelSpendDaily[]
  labels: AdminShipEngineLabelSpendRow[]
  truncated: boolean
  listedTotal: number
}

export type AdminShipEngineLabelSpendResult =
  | { ok: true; data: AdminShipEngineLabelSpend }
  | { ok: false; message: string; status: number }

function trackingKey(tracking: string | null | undefined): string {
  if (!tracking) return ""
  return normalizeTrackingNumberForCarrier(tracking) || tracking.trim()
}

/**
 * ShipEngine-billed postage for a Pacific date range, plus buyer shipping collected
 * on matched orders — the amount to move from Stripe back to the bank.
 */
export async function getAdminShipEngineLabelSpend(input: {
  dateFrom?: string
  dateTo?: string
}): Promise<AdminShipEngineLabelSpendResult> {
  const resolved = resolveLabelSpendDateRange(input)
  if (!resolved.ok) {
    return { ok: false, message: resolved.message, status: 400 }
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const listed = await listPurchasedShipEngineLabels({
    createdAtStartIso: resolved.range.startIso,
    createdAtEndIso: resolved.range.endIsoExclusive,
  })
  if (!listed.ok) {
    console.error("[admin label spend] ShipEngine list:", listed.error)
    return { ok: false, message: listed.error, status: listed.status }
  }

  const [adjustments, matches] = await Promise.all([
    dbListLabelAdjustmentsInRange(supabase, {
      startIso: resolved.range.startIso,
      endIso: resolved.range.endIsoExclusive,
    }),
    dbMatchTrackingToOrders(
      supabase,
      listed.labels.map((row) => row.trackingNumber).filter((tn): tn is string => Boolean(tn)),
    ),
  ])

  if (adjustments.error) {
    console.error("[admin label spend] adjustments:", adjustments.error.message)
    return { ok: false, message: "Could not load label fee adjustments", status: 500 }
  }
  if (matches.error) {
    console.error("[admin label spend] order match:", matches.error.message)
    return { ok: false, message: "Could not match labels to orders", status: 500 }
  }

  const adjustmentsUsd = adjustments.data.reduce((sum, row) => sum + row.adjustmentAmountUsd, 0)

  const seenOrders = new Set<string>()
  let buyerShippingCollectedUsd = 0
  for (const match of matches.data.values()) {
    if (seenOrders.has(match.orderId)) continue
    seenOrders.add(match.orderId)
    buyerShippingCollectedUsd += match.shippingAmountUsd
  }

  const labels: AdminShipEngineLabelSpendRow[] = listed.labels.map((label) => {
    const key = trackingKey(label.trackingNumber)
    const match = key ? matches.data.get(key) : undefined
    const chargeUsd = roundMoney(chargeUsdForPurchasedLabel(label))
    return {
      labelId: label.labelId,
      createdAt: label.createdAt,
      trackingNumber: label.trackingNumber,
      carrierCode: label.carrierCode,
      serviceCode: label.serviceCode,
      voided: label.voided,
      isReturnLabel: label.isReturnLabel,
      kind: kindForPurchasedLabel(label),
      postageUsd: roundMoney(label.postageUsd),
      insuranceUsd: roundMoney(label.insuranceUsd),
      chargeUsd,
      orderId: match?.orderId ?? null,
      orderDisplayNum: match
        ? formatOrderNumForCustomer(match.orderNum, match.orderId)
        : null,
    }
  })

  const dayMap = new Map<string, { count: number; transferUsd: number }>()
  for (const label of listed.labels) {
    if (!label.createdAt) continue
    const day = businessDayKeyFromMs(Date.parse(label.createdAt))
    const bucket = dayMap.get(day) ?? { count: 0, transferUsd: 0 }
    if (!label.voided) bucket.count += 1
    bucket.transferUsd += chargeUsdForPurchasedLabel(label)
    dayMap.set(day, bucket)
  }
  const dailySeries = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, count: v.count, transferUsd: roundMoney(v.transferUsd) }))

  return {
    ok: true,
    data: {
      timezoneLabel: BUSINESS_TIMEZONE_LABEL,
      range: { dateFrom: resolved.range.dateFrom, dateTo: resolved.range.dateTo },
      totals: buildLabelSpendTotals({
        labels: listed.labels,
        adjustmentsUsd,
        buyerShippingCollectedUsd,
        matchedOrders: seenOrders.size,
      }),
      dailySeries,
      labels,
      truncated: listed.truncated,
      listedTotal: listed.total,
    },
  }
}
