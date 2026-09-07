import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { ReswellListingRateRow } from "@/lib/services/reswellListingShippingRate"

const USPS_GROUND_PRIORITY_CODES = [
  "usps_ground_advantage",
  "usps_parcel_select",
  "usps_priority_mail",
] as const

/** ShipEngine service codes allowed for peer checkout by product section. */
export const PEER_CHECKOUT_USPS_SERVICE_CODES: Partial<
  Record<PeerListingSection, readonly string[]>
> = {
  fins: USPS_GROUND_PRIORITY_CODES,
  apparel: USPS_GROUND_PRIORITY_CODES,
  magazines: ["usps_media_mail"],
}

const FIN_GROUND_CODES = new Set(["usps_ground_advantage", "usps_parcel_select"])
const FIN_PRIORITY_CODES = new Set(["usps_priority_mail"])

/** Buyer-facing labels for checkout rate pickers. */
export const PEER_CHECKOUT_USPS_DISPLAY_NAMES: Record<string, string> = {
  usps_ground_advantage: "USPS Ground",
  usps_parcel_select: "USPS Ground",
  usps_priority_mail: "USPS Priority",
  usps_media_mail: "USPS Media Mail",
}

export type PeerCheckoutShippingRateOption = {
  rateId: string
  serviceCode: string
  serviceName: string
  displayName: string
  totalAmount: number
  deliveryDays: number | null
  /** ShipEngine `estimated_delivery_date` (ISO), normalized to a calendar day. */
  estimatedDeliveryDate: string | null
}

type UpsCheckoutBucket = "ground" | "3_day" | "2nd_day"

const UPS_CHECKOUT_DISPLAY_NAMES: Record<UpsCheckoutBucket, string> = {
  ground: "UPS Ground",
  "3_day": "UPS 3 Day Select",
  "2nd_day": "UPS Second Day Air",
}

function normalizeServiceCode(code: string | null | undefined): string {
  return (code ?? "").trim().toLowerCase()
}

function isUspsCarrierRow(row: ReswellListingRateRow): boolean {
  const carrierCode = (row.carrierCode ?? "").trim().toLowerCase()
  if (carrierCode === "usps" || carrierCode === "stamps_com") return true
  const carrierName = row.carrierName.trim().toLowerCase()
  return carrierName.includes("usps") || carrierName.includes("postal")
}

function isUpsCarrierRow(row: ReswellListingRateRow): boolean {
  const carrierCode = (row.carrierCode ?? "").trim().toLowerCase()
  const carrierName = row.carrierName.trim().toLowerCase()
  const blob = `${carrierCode} ${carrierName}`
  if (!blob.includes("ups")) return false
  if (blob.includes("usps")) return false
  if (blob.includes("freight")) return false
  return true
}

function serviceBlob(serviceCode: string | null | undefined, serviceName: string | null | undefined): string {
  return `${serviceCode ?? ""} ${serviceName ?? ""}`.trim().toLowerCase()
}

/** Maps a UPS rate to Ground / 3 Day Select / Second Day Air. Excludes AM, Next Day, and Ground Saver. */
export function upsSurfboardCheckoutBucket(
  serviceCode: string | null | undefined,
  serviceName: string | null | undefined,
): UpsCheckoutBucket | null {
  const text = serviceBlob(serviceCode, serviceName)
  if (!text) return null
  if (
    text.includes("air_am") ||
    text.includes("a.m.") ||
    text.includes("early") ||
    text.includes("next_day") ||
    text.includes("next day") ||
    text.includes("overnight") ||
    text.includes("ground_saver") ||
    text.includes("ground saver")
  ) {
    return null
  }
  if (
    text.includes("3_day_select") ||
    text.includes("3-day select") ||
    text.includes("3 day select") ||
    text.includes("3day select")
  ) {
    return "3_day"
  }
  if (
    text.includes("2nd_day_air") ||
    text.includes("2nd day air") ||
    text.includes("second day air") ||
    text.includes("second_day_air") ||
    text.includes("2 day air") ||
    text.includes("2-day air")
  ) {
    return "2nd_day"
  }
  if (text.includes("ups_ground") || (text.includes("ground") && !text.includes("surepost"))) {
    return "ground"
  }
  return null
}

function upsServiceSortKey(bucket: UpsCheckoutBucket): number {
  if (bucket === "ground") return 0
  if (bucket === "3_day") return 1
  return 2
}

/**
 * Carrier estimated-delivery timestamps at midnight UTC are calendar dates, not instants.
 * Shift those to noon UTC so the buyer’s local date matches the carrier’s promised day.
 */
export function normalizeCarrierEstimatedDeliveryIso(iso: string | null | undefined): string | null {
  const raw = iso?.trim()
  if (!raw) return null
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(raw)
  if (dateOnly) return `${dateOnly[1]}T12:00:00.000Z`
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  if (/T00:00:00/.test(raw)) {
    const y = parsed.getUTCFullYear()
    const m = String(parsed.getUTCMonth() + 1).padStart(2, "0")
    const d = String(parsed.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}T12:00:00.000Z`
  }
  return parsed.toISOString()
}

function serviceCodeAllowedForSection(
  section: PeerListingSection,
  serviceCode: string,
): boolean {
  const allowlist = PEER_CHECKOUT_USPS_SERVICE_CODES[section]
  if (!allowlist) return true
  return allowlist.includes(serviceCode)
}

function finServiceSortKey(serviceCode: string): number {
  if (FIN_GROUND_CODES.has(serviceCode)) return 0
  if (FIN_PRIORITY_CODES.has(serviceCode)) return 1
  return 2
}

export function peerCheckoutUsesUspsGroundPriorityChoice(
  section: string | null | undefined,
): boolean {
  return section === "fins" || section === "apparel"
}

export function peerCheckoutUsesUpsSurfboardChoice(
  section: string | null | undefined,
): boolean {
  return section === "surfboards"
}

export function peerCheckoutSectionRestrictsUspsServices(
  section: string | null | undefined,
): section is PeerListingSection {
  return (
    peerCheckoutUsesUspsGroundPriorityChoice(section) ||
    section === "magazines" ||
    peerCheckoutUsesUpsSurfboardChoice(section)
  )
}

export function peerCheckoutOffersShippingRateChoice(
  section: string | null | undefined,
): boolean {
  return peerCheckoutUsesUspsGroundPriorityChoice(section) || peerCheckoutUsesUpsSurfboardChoice(section)
}

export function peerCheckoutSharedSection(
  sections: Array<string | null | undefined>,
): string | null {
  const first = sections[0]?.trim() || null
  if (!first) return null
  if (sections.every((s) => (s ?? "").trim() === first)) return first
  return null
}

export function peerCheckoutRateChoiceIntro(section: string | null | undefined): string {
  if (peerCheckoutUsesUpsSurfboardChoice(section)) {
    return "Choose UPS shipping. The amount you select is included in your total."
  }
  return "Choose USPS shipping. The amount you select is included in your total."
}

export function filterReswellRatesForPeerSection(
  rates: ReswellListingRateRow[],
  section: string | null | undefined,
): ReswellListingRateRow[] {
  if (!peerCheckoutSectionRestrictsUspsServices(section)) {
    return rates
  }

  if (peerCheckoutUsesUpsSurfboardChoice(section)) {
    return rates.filter((row) => {
      if (!row.rate_id) return false
      if (!isUpsCarrierRow(row)) return false
      return upsSurfboardCheckoutBucket(row.serviceCode, row.serviceName) != null
    })
  }

  return rates.filter((row) => {
    if (!row.rate_id) return false
    if (!isUspsCarrierRow(row)) return false
    const serviceCode = normalizeServiceCode(row.serviceCode)
    if (!serviceCode) return false
    return serviceCodeAllowedForSection(section, serviceCode)
  })
}

export function toPeerCheckoutShippingRateOptions(
  rates: ReswellListingRateRow[],
  section: string | null | undefined,
): PeerCheckoutShippingRateOption[] {
  const filtered = filterReswellRatesForPeerSection(rates, section)
  const options = filtered
    .filter((row): row is ReswellListingRateRow & { rate_id: string } => Boolean(row.rate_id))
    .map((row) => {
      const serviceCode = normalizeServiceCode(row.serviceCode)
      const upsBucket = peerCheckoutUsesUpsSurfboardChoice(section)
        ? upsSurfboardCheckoutBucket(serviceCode, row.serviceName)
        : null
      return {
        rateId: row.rate_id,
        serviceCode,
        serviceName: row.serviceName,
        displayName:
          (upsBucket ? UPS_CHECKOUT_DISPLAY_NAMES[upsBucket] : null) ??
          PEER_CHECKOUT_USPS_DISPLAY_NAMES[serviceCode] ??
          (row.serviceName.trim() || "Shipping"),
        totalAmount: row.totalAmount,
        deliveryDays: row.deliveryDays,
        estimatedDeliveryDate: row.estimatedDeliveryDate,
      }
    })

  if (peerCheckoutUsesUpsSurfboardChoice(section)) {
    const byBucket = new Map<UpsCheckoutBucket, PeerCheckoutShippingRateOption>()
    for (const option of options) {
      const bucket = upsSurfboardCheckoutBucket(option.serviceCode, option.serviceName)
      if (!bucket) continue
      const existing = byBucket.get(bucket)
      if (!existing || option.totalAmount < existing.totalAmount) {
        byBucket.set(bucket, option)
      }
    }
    return [...byBucket.values()].sort((a, b) => {
      const aBucket = upsSurfboardCheckoutBucket(a.serviceCode, a.serviceName)
      const bBucket = upsSurfboardCheckoutBucket(b.serviceCode, b.serviceName)
      if (!aBucket || !bBucket) return a.totalAmount - b.totalAmount
      return upsServiceSortKey(aBucket) - upsServiceSortKey(bBucket)
    })
  }

  if (peerCheckoutUsesUspsGroundPriorityChoice(section)) {
    options.sort((a, b) => {
      const order = finServiceSortKey(a.serviceCode) - finServiceSortKey(b.serviceCode)
      if (order !== 0) return order
      return a.totalAmount - b.totalAmount
    })

    const byBucket = new Map<"ground" | "priority", PeerCheckoutShippingRateOption>()
    for (const option of options) {
      const bucket: "ground" | "priority" | null = FIN_GROUND_CODES.has(option.serviceCode)
        ? "ground"
        : FIN_PRIORITY_CODES.has(option.serviceCode)
          ? "priority"
          : null
      if (!bucket) continue
      const existing = byBucket.get(bucket)
      if (!existing || option.totalAmount < existing.totalAmount) {
        byBucket.set(bucket, option)
      }
    }

    return [...byBucket.values()].sort(
      (a, b) => finServiceSortKey(a.serviceCode) - finServiceSortKey(b.serviceCode),
    )
  } else {
    options.sort((a, b) => a.totalAmount - b.totalAmount)
  }

  return options
}

export function selectDefaultPeerCheckoutRateId(
  options: PeerCheckoutShippingRateOption[],
): string | null {
  return options[0]?.rateId ?? null
}

export function findPeerCheckoutRateOption(
  options: PeerCheckoutShippingRateOption[],
  rateId: string | null | undefined,
): PeerCheckoutShippingRateOption | null {
  const trimmed = rateId?.trim()
  if (!trimmed) return null
  return options.find((option) => option.rateId === trimmed) ?? null
}

/**
 * ShipEngine `rate_id` values expire between `/rates` calls. Buyers pick a stable
 * service bucket (USPS Ground vs Priority, or UPS Ground / 3 Day / Second Day);
 * resolve that bucket on fresh quotes.
 */
export function findPeerCheckoutRateOptionByServiceCode(
  options: PeerCheckoutShippingRateOption[],
  serviceCode: string | null | undefined,
  section?: string | null,
): PeerCheckoutShippingRateOption | null {
  const normalized = normalizeServiceCode(serviceCode)
  if (!normalized) return null

  const exact = options.find((option) => normalizeServiceCode(option.serviceCode) === normalized)
  if (exact) return exact

  if (peerCheckoutUsesUspsGroundPriorityChoice(section)) {
    if (FIN_GROUND_CODES.has(normalized)) {
      return options.find((option) => FIN_GROUND_CODES.has(option.serviceCode)) ?? null
    }
    if (FIN_PRIORITY_CODES.has(normalized)) {
      return options.find((option) => FIN_PRIORITY_CODES.has(option.serviceCode)) ?? null
    }
  }

  if (peerCheckoutUsesUpsSurfboardChoice(section)) {
    const wanted = upsSurfboardCheckoutBucket(normalized, normalized)
    if (!wanted) return null
    return (
      options.find((option) => upsSurfboardCheckoutBucket(option.serviceCode, option.serviceName) === wanted) ??
      null
    )
  }

  return null
}

export function peerCheckoutShippingServiceError(section: string | null | undefined): string {
  if (peerCheckoutUsesUspsGroundPriorityChoice(section)) {
    return "USPS Ground and USPS Priority are not available for this shipment. Try a different address or contact support."
  }
  if (peerCheckoutUsesUpsSurfboardChoice(section)) {
    return "UPS Ground, 3 Day Select, and UPS Second Day Air are not available for this shipment. Try a different address or contact support."
  }
  if (section === "magazines") {
    return "USPS Media Mail is not available for this shipment. Try a different address or contact support."
  }
  return "No carrier rates returned for this shipment."
}
