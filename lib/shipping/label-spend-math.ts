import type { ShipEnginePurchasedLabel } from "../shipengine/purchased-label.ts"
import {
  addBusinessDays,
  businessDayKeyFromMs,
  businessDayStartMs,
} from "../utils/business-timezone.ts"

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 366

export type LabelSpendDateRange = {
  dateFrom: string
  dateTo: string
  startIso: string
  endIsoExclusive: string
}

export function defaultLabelSpendDateRange(nowMs = Date.now()): { dateFrom: string; dateTo: string } {
  const today = businessDayKeyFromMs(nowMs)
  return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }
}

export function resolveLabelSpendDateRange(input: {
  dateFrom?: string
  dateTo?: string
  nowMs?: number
}): { ok: true; range: LabelSpendDateRange } | { ok: false; message: string } {
  const fallback = defaultLabelSpendDateRange(input.nowMs)
  const dateFrom = input.dateFrom?.trim() || fallback.dateFrom
  const dateTo = input.dateTo?.trim() || fallback.dateTo

  if (!DATE_KEY_RE.test(dateFrom) || !DATE_KEY_RE.test(dateTo)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." }
  }
  if (dateFrom > dateTo) {
    return { ok: false, message: "Start date must be on or before end date." }
  }

  const startMs = businessDayStartMs(dateFrom)
  const endExclusiveMs = businessDayStartMs(addBusinessDays(dateTo, 1))
  const dayCount = Math.round((endExclusiveMs - startMs) / (24 * 60 * 60 * 1000))
  if (dayCount > MAX_RANGE_DAYS) {
    return { ok: false, message: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` }
  }

  return {
    ok: true,
    range: {
      dateFrom,
      dateTo,
      startIso: new Date(startMs).toISOString(),
      endIsoExclusive: new Date(endExclusiveMs).toISOString(),
    },
  }
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type LabelSpendKind = "outbound" | "return" | "voided"

export function kindForPurchasedLabel(label: Pick<ShipEnginePurchasedLabel, "voided" | "isReturnLabel">): LabelSpendKind {
  if (label.voided) return "voided"
  if (label.isReturnLabel) return "return"
  return "outbound"
}

export type AdminShipEngineLabelSpendTotals = {
  labelsPurchased: number
  labelsVoided: number
  labelsReturn: number
  postageUsd: number
  insuranceUsd: number
  adjustmentsUsd: number
  /** postage + insurance (non-voided) + carrier adjustments. Pull this from Stripe. */
  transferUsd: number
  buyerShippingCollectedUsd: number
  matchedOrders: number
}

export function buildLabelSpendTotals(params: {
  labels: Array<Pick<ShipEnginePurchasedLabel, "voided" | "isReturnLabel" | "postageUsd" | "insuranceUsd">>
  adjustmentsUsd: number
  buyerShippingCollectedUsd: number
  matchedOrders: number
}): AdminShipEngineLabelSpendTotals {
  let labelsVoided = 0
  let labelsReturn = 0
  let postageUsd = 0
  let insuranceUsd = 0

  for (const label of params.labels) {
    if (label.voided) {
      labelsVoided += 1
      continue
    }
    if (label.isReturnLabel) labelsReturn += 1
    postageUsd += label.postageUsd
    insuranceUsd += label.insuranceUsd
  }

  const postage = roundMoney(postageUsd)
  const insurance = roundMoney(insuranceUsd)
  const adjustments = roundMoney(params.adjustmentsUsd)

  return {
    labelsPurchased: params.labels.length - labelsVoided,
    labelsVoided,
    labelsReturn,
    postageUsd: postage,
    insuranceUsd: insurance,
    adjustmentsUsd: adjustments,
    transferUsd: roundMoney(postage + insurance + adjustments),
    buyerShippingCollectedUsd: roundMoney(params.buyerShippingCollectedUsd),
    matchedOrders: params.matchedOrders,
  }
}
