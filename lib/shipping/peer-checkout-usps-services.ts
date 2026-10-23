import { PEER_LISTING_SECTIONS, type PeerListingSection } from "@/lib/peer-listing-sections"
import type { ReswellListingRateRow } from "@/lib/services/reswellListingShippingRate"
import { normalizeUsStateProvinceForShipping } from "../us-state-name-to-code.ts"

const USPS_GROUND_PRIORITY_CODES = [
  "usps_ground_advantage",
  "usps_parcel_select",
  "usps_priority_mail",
] as const

/**
 * Small parcels share one USPS Ground / Priority checkout.
 * Surfboards stay on UPS/FedEx. Magazines stay on Media Mail when they ship alone.
 */
const USPS_SMALL_PARCEL_SECTIONS = PEER_LISTING_SECTIONS.filter(
  (section) => section !== "surfboards" && section !== "magazines",
)

const USPS_SMALL_PARCEL_SECTION_SET = new Set<string>(USPS_SMALL_PARCEL_SECTIONS)

/** ShipEngine service codes allowed for peer checkout by product section. */
export const PEER_CHECKOUT_USPS_SERVICE_CODES: Partial<
  Record<PeerListingSection, readonly string[]>
> = {
  ...Object.fromEntries(USPS_SMALL_PARCEL_SECTIONS.map((section) => [section, USPS_GROUND_PRIORITY_CODES])),
  magazines: ["usps_media_mail"],
}

/**
 * How a checkout picks carrier services. Mixed small-parcel categories
 * (a leash plus fins) stay on one USPS choice. Any surfboard keeps the board menu.
 */
export type PeerCheckoutRateFamily = "usps_ground_priority" | "usps_media_mail" | "ups_fedex_surfboard"

export function peerCheckoutRateFamilyForSections(
  sections: Array<string | null | undefined>,
): PeerCheckoutRateFamily | null {
  const present = sections.map((section) => section?.trim() || "").filter((section) => section.length > 0)
  if (present.length === 0) return null
  if (present.some((section) => section === "surfboards")) return "ups_fedex_surfboard"
  if (present.every((section) => section === "magazines")) return "usps_media_mail"
  if (present.every((section) => USPS_SMALL_PARCEL_SECTION_SET.has(section) || section === "magazines")) {
    return "usps_ground_priority"
  }
  return null
}

function effectivePeerCheckoutRateFamily(
  section: string | null | undefined,
  rateFamily?: PeerCheckoutRateFamily | null,
): PeerCheckoutRateFamily | null {
  if (rateFamily) return rateFamily
  if (!section?.trim()) return null
  return peerCheckoutRateFamilyForSections([section])
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

export type PeerCheckoutShipTo = {
  stateProvince?: string | null
  postalCode?: string | null
}

type SurfboardCheckoutBucket =
  | "ups_ground"
  | "ups_3_day"
  | "ups_2nd_day"
  | "ups_next_day"
  | "fedex_2day"
  | "fedex_overnight"

const SURFBOARD_CHECKOUT_DISPLAY_NAMES: Record<SurfboardCheckoutBucket, string> = {
  ups_ground: "UPS Ground",
  ups_3_day: "UPS 3 Day Select",
  ups_2nd_day: "UPS Second Day Air",
  ups_next_day: "UPS Next Day Air",
  fedex_2day: "FedEx 2Day",
  fedex_overnight: "FedEx Overnight",
}

const CONTINENTAL_SURFBOARD_BUCKETS = new Set<SurfboardCheckoutBucket>([
  "ups_ground",
  "ups_3_day",
  "ups_2nd_day",
])

const HAWAII_ALASKA_SURFBOARD_BUCKETS = new Set<SurfboardCheckoutBucket>([
  "ups_2nd_day",
  "ups_next_day",
  "fedex_2day",
  "fedex_overnight",
])

function normalizeServiceCode(code: string | null | undefined): string {
  return (code ?? "").trim().toLowerCase()
}

type CarrierHintRow = Pick<ReswellListingRateRow, "carrierCode" | "carrierName">

function isUspsCarrierRow(row: CarrierHintRow): boolean {
  const carrierCode = (row.carrierCode ?? "").trim().toLowerCase()
  if (carrierCode === "usps" || carrierCode === "stamps_com") return true
  const carrierName = row.carrierName.trim().toLowerCase()
  return carrierName.includes("usps") || carrierName.includes("postal")
}

function isUpsCarrierRow(row: CarrierHintRow): boolean {
  const carrierCode = (row.carrierCode ?? "").trim().toLowerCase()
  const carrierName = row.carrierName.trim().toLowerCase()
  const blob = `${carrierCode} ${carrierName}`
  if (!blob.includes("ups")) return false
  if (blob.includes("usps")) return false
  if (blob.includes("freight")) return false
  return true
}

function isFedexCarrierRow(row: CarrierHintRow): boolean {
  const carrierCode = (row.carrierCode ?? "").trim().toLowerCase()
  const carrierName = row.carrierName.trim().toLowerCase()
  const blob = `${carrierCode} ${carrierName}`
  if (!blob.includes("fedex") && !blob.includes("fed ex")) return false
  if (blob.includes("freight")) return false
  return true
}

function serviceBlob(serviceCode: string | null | undefined, serviceName: string | null | undefined): string {
  return `${serviceCode ?? ""} ${serviceName ?? ""}`.trim().toLowerCase()
}

/** Hawaii / Alaska — UPS Ground and 3 Day Select do not serve these destinations. */
export function isNonContiguousUsShipTo(shipTo?: PeerCheckoutShipTo | null): boolean {
  if (!shipTo) return false
  const state = normalizeUsStateProvinceForShipping("US", shipTo.stateProvince ?? "")
  if (state === "HI" || state === "AK") return true
  const zip = (shipTo.postalCode ?? "").replace(/\D/g, "")
  if (/^(967|968)/.test(zip)) return true
  if (/^99[5-9]/.test(zip)) return true
  return false
}

function isExcludedPremiumOrEconomyService(text: string): boolean {
  return (
    text.includes("ground_saver") ||
    text.includes("ground saver") ||
    text.includes("surepost") ||
    text.includes("home_delivery") ||
    text.includes("home delivery") ||
    text.includes("ground_economy") ||
    text.includes("ground economy")
  )
}

function isUpsNextDayService(text: string): boolean {
  return (
    text.includes("next_day") ||
    text.includes("next day") ||
    text.includes("overnight")
  )
}

function isUpsSecondDayService(text: string): boolean {
  return (
    text.includes("2nd_day_air") ||
    text.includes("2nd day air") ||
    text.includes("second day air") ||
    text.includes("second_day_air") ||
    text.includes("2 day air") ||
    text.includes("2-day air")
  )
}

function isFedexOvernightService(text: string): boolean {
  return text.includes("overnight") || text.includes("first_overnight") || text.includes("first overnight")
}

function isFedexTwoDayService(text: string): boolean {
  return (
    text.includes("2day") ||
    text.includes("2_day") ||
    text.includes("2-day") ||
    text.includes("2 day") ||
    text.includes("express_saver") ||
    text.includes("express saver")
  )
}

/**
 * Maps a surfboard parcel rate to a checkout bucket.
 * Continental US: UPS Ground / 3 Day / Second Day only.
 * Hawaii & Alaska: UPS and FedEx air services that actually serve those lanes.
 */
export function surfboardCheckoutBucket(
  serviceCode: string | null | undefined,
  serviceName: string | null | undefined,
  carrier: "ups" | "fedex",
  shipTo?: PeerCheckoutShipTo | null,
): SurfboardCheckoutBucket | null {
  const text = serviceBlob(serviceCode, serviceName)
  if (!text || isExcludedPremiumOrEconomyService(text)) return null

  const hawaiiAlaska = isNonContiguousUsShipTo(shipTo)

  if (carrier === "fedex") {
    if (!hawaiiAlaska) return null
    if (isFedexOvernightService(text)) return "fedex_overnight"
    if (isFedexTwoDayService(text)) return "fedex_2day"
    return null
  }

  if (hawaiiAlaska) {
    if (isUpsNextDayService(text)) return "ups_next_day"
    if (isUpsSecondDayService(text)) return "ups_2nd_day"
    return null
  }

  if (isUpsNextDayService(text) || text.includes("air_am") || text.includes("a.m.") || text.includes("early")) {
    return null
  }
  if (
    text.includes("3_day_select") ||
    text.includes("3-day select") ||
    text.includes("3 day select") ||
    text.includes("3day select")
  ) {
    return "ups_3_day"
  }
  if (isUpsSecondDayService(text)) return "ups_2nd_day"
  if (text.includes("ups_ground") || (text.includes("ground") && !text.includes("surepost"))) {
    return "ups_ground"
  }
  return null
}

/** @deprecated Use {@link surfboardCheckoutBucket} — continental UPS Ground / 3 Day / 2nd Day only. */
export function upsSurfboardCheckoutBucket(
  serviceCode: string | null | undefined,
  serviceName: string | null | undefined,
): "ground" | "3_day" | "2nd_day" | null {
  const bucket = surfboardCheckoutBucket(serviceCode, serviceName, "ups")
  if (bucket === "ups_ground") return "ground"
  if (bucket === "ups_3_day") return "3_day"
  if (bucket === "ups_2nd_day") return "2nd_day"
  return null
}

function surfboardServiceSortKey(bucket: SurfboardCheckoutBucket): number {
  switch (bucket) {
    case "ups_ground":
      return 0
    case "ups_3_day":
      return 1
    case "ups_2nd_day":
      return 2
    case "fedex_2day":
      return 3
    case "ups_next_day":
      return 4
    case "fedex_overnight":
      return 5
  }
}

function rowSurfboardCheckoutBucket(
  row: Pick<ReswellListingRateRow, "carrierCode" | "carrierName" | "serviceCode" | "serviceName">,
  shipTo?: PeerCheckoutShipTo | null,
): SurfboardCheckoutBucket | null {
  if (isUpsCarrierRow(row)) {
    return surfboardCheckoutBucket(row.serviceCode, row.serviceName, "ups", shipTo)
  }
  if (isFedexCarrierRow(row)) {
    return surfboardCheckoutBucket(row.serviceCode, row.serviceName, "fedex", shipTo)
  }
  return null
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

function finServiceSortKey(serviceCode: string): number {
  if (FIN_GROUND_CODES.has(serviceCode)) return 0
  if (FIN_PRIORITY_CODES.has(serviceCode)) return 1
  return 2
}

export function peerCheckoutUsesUspsGroundPriorityChoice(
  section: string | null | undefined,
): boolean {
  const normalized = section?.trim() || ""
  return USPS_SMALL_PARCEL_SECTION_SET.has(normalized)
}

export function peerCheckoutUsesUpsSurfboardChoice(
  section: string | null | undefined,
): boolean {
  return section === "surfboards"
}

export function peerCheckoutSectionRestrictsUspsServices(
  section: string | null | undefined,
  rateFamily?: PeerCheckoutRateFamily | null,
): boolean {
  return effectivePeerCheckoutRateFamily(section, rateFamily) != null
}

export function peerCheckoutOffersShippingRateChoice(
  section: string | null | undefined,
  rateFamily?: PeerCheckoutRateFamily | null,
): boolean {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  return family === "usps_ground_priority" || family === "ups_fedex_surfboard"
}

/** USPS can deliver to PO Boxes. UPS/FedEx (surfboards and unknown mix) cannot. */
export function peerCheckoutAllowsPoBoxDestination(
  sections: Array<string | null | undefined>,
): boolean {
  const family = peerCheckoutRateFamilyForSections(sections)
  return family === "usps_ground_priority" || family === "usps_media_mail"
}

export const UPS_FEDEX_PO_BOX_ERROR =
  "UPS and FedEx cannot deliver to a PO Box. Enter a street address, or choose pickup if it is available."

export function peerCheckoutSharedSection(
  sections: Array<string | null | undefined>,
): string | null {
  const first = sections[0]?.trim() || null
  if (!first) return null
  if (sections.every((s) => (s ?? "").trim() === first)) return first
  return null
}

export function peerCheckoutRateChoiceIntro(
  section: string | null | undefined,
  rateFamily?: PeerCheckoutRateFamily | null,
): string {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  if (family === "ups_fedex_surfboard" || peerCheckoutUsesUpsSurfboardChoice(section)) {
    return "Choose UPS or FedEx shipping. The amount you select is included in your total."
  }
  return "Choose USPS Ground or Priority. Everything in this order ships in one box, and the price includes the combined weight."
}

/** Cart summary when a seller group is entirely calculated small-parcel shipping. */
export function peerCheckoutSmallParcelBundleCopy(input: {
  sections: Array<string | null | undefined>
  allReswell: boolean
  unitCount: number
}): { label: string; note: string } | null {
  if (!input.allReswell || input.unitCount < 1) return null
  if (peerCheckoutRateFamilyForSections(input.sections) !== "usps_ground_priority") return null
  if (input.unitCount === 1) {
    return {
      label: "USPS at checkout",
      note: "Choose USPS Ground or Priority at checkout. The rate uses this item's weight.",
    }
  }
  return {
    label: "One box at checkout",
    note: "These ship together in one box. Checkout adds the weights, including quantity, then lets you choose USPS Ground or Priority.",
  }
}

export function filterReswellRatesForPeerSection(
  rates: ReswellListingRateRow[],
  section: string | null | undefined,
  shipTo?: PeerCheckoutShipTo | null,
  rateFamily?: PeerCheckoutRateFamily | null,
): ReswellListingRateRow[] {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  if (!family) {
    return rates
  }

  if (family === "ups_fedex_surfboard") {
    const allowed = isNonContiguousUsShipTo(shipTo)
      ? HAWAII_ALASKA_SURFBOARD_BUCKETS
      : CONTINENTAL_SURFBOARD_BUCKETS
    return rates.filter((row) => {
      if (!row.rate_id) return false
      const bucket = rowSurfboardCheckoutBucket(row, shipTo)
      return bucket != null && allowed.has(bucket)
    })
  }

  return rates.filter((row) => {
    if (!row.rate_id) return false
    if (!isUspsCarrierRow(row)) return false
    const serviceCode = normalizeServiceCode(row.serviceCode)
    if (!serviceCode) return false
    if (family === "usps_media_mail") return serviceCode === "usps_media_mail"
    return (USPS_GROUND_PRIORITY_CODES as readonly string[]).includes(serviceCode)
  })
}

export function toPeerCheckoutShippingRateOptions(
  rates: ReswellListingRateRow[],
  section: string | null | undefined,
  shipTo?: PeerCheckoutShipTo | null,
  rateFamily?: PeerCheckoutRateFamily | null,
): PeerCheckoutShippingRateOption[] {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  const filtered = filterReswellRatesForPeerSection(rates, section, shipTo, rateFamily)
  const options = filtered
    .filter((row): row is ReswellListingRateRow & { rate_id: string } => Boolean(row.rate_id))
    .map((row) => {
      const serviceCode = normalizeServiceCode(row.serviceCode)
      const surfboardBucket =
        family === "ups_fedex_surfboard" ? rowSurfboardCheckoutBucket(row, shipTo) : null
      return {
        rateId: row.rate_id,
        serviceCode,
        serviceName: row.serviceName,
        displayName:
          (surfboardBucket ? SURFBOARD_CHECKOUT_DISPLAY_NAMES[surfboardBucket] : null) ??
          PEER_CHECKOUT_USPS_DISPLAY_NAMES[serviceCode] ??
          (row.serviceName.trim() || "Shipping"),
        totalAmount: row.totalAmount,
        deliveryDays: row.deliveryDays,
        estimatedDeliveryDate: row.estimatedDeliveryDate,
      }
    })

  if (family === "ups_fedex_surfboard") {
    const byBucket = new Map<SurfboardCheckoutBucket, PeerCheckoutShippingRateOption>()
    for (const option of options) {
      const source = filtered.find((row) => row.rate_id === option.rateId)
      const bucket = source ? rowSurfboardCheckoutBucket(source, shipTo) : null
      if (!bucket) continue
      const existing = byBucket.get(bucket)
      if (!existing || option.totalAmount < existing.totalAmount) {
        byBucket.set(bucket, option)
      }
    }
    return [...byBucket.values()].sort((a, b) => {
      const aSource = filtered.find((row) => row.rate_id === a.rateId)
      const bSource = filtered.find((row) => row.rate_id === b.rateId)
      const aBucket = aSource ? rowSurfboardCheckoutBucket(aSource, shipTo) : null
      const bBucket = bSource ? rowSurfboardCheckoutBucket(bSource, shipTo) : null
      if (!aBucket || !bBucket) return a.totalAmount - b.totalAmount
      return surfboardServiceSortKey(aBucket) - surfboardServiceSortKey(bBucket)
    })
  }

  if (family === "usps_ground_priority") {
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
 * service bucket (USPS Ground vs Priority, continental UPS Ground / 3 Day / 2nd Day,
 * or Hawaii/Alaska UPS and FedEx air); resolve that bucket on fresh quotes.
 */
export function findPeerCheckoutRateOptionByServiceCode(
  options: PeerCheckoutShippingRateOption[],
  serviceCode: string | null | undefined,
  section?: string | null,
  shipTo?: PeerCheckoutShipTo | null,
  rateFamily?: PeerCheckoutRateFamily | null,
): PeerCheckoutShippingRateOption | null {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  const normalized = normalizeServiceCode(serviceCode)
  if (!normalized) return null

  const exact = options.find((option) => normalizeServiceCode(option.serviceCode) === normalized)
  if (exact) return exact

  if (family === "usps_ground_priority") {
    if (FIN_GROUND_CODES.has(normalized)) {
      return options.find((option) => FIN_GROUND_CODES.has(option.serviceCode)) ?? null
    }
    if (FIN_PRIORITY_CODES.has(normalized)) {
      return options.find((option) => FIN_PRIORITY_CODES.has(option.serviceCode)) ?? null
    }
  }

  if (family === "ups_fedex_surfboard") {
    const wanted =
      surfboardCheckoutBucket(normalized, normalized, "ups", shipTo) ??
      surfboardCheckoutBucket(normalized, normalized, "fedex", shipTo)
    if (!wanted) return null
    return (
      options.find((option) => {
        const bucket =
          surfboardCheckoutBucket(option.serviceCode, option.serviceName, "ups", shipTo) ??
          surfboardCheckoutBucket(option.serviceCode, option.serviceName, "fedex", shipTo)
        return bucket === wanted
      }) ?? null
    )
  }

  return null
}

export function peerCheckoutShippingServiceError(
  section: string | null | undefined,
  shipTo?: PeerCheckoutShipTo | null,
  rateFamily?: PeerCheckoutRateFamily | null,
): string {
  const family = effectivePeerCheckoutRateFamily(section, rateFamily)
  if (family === "usps_ground_priority") {
    return "USPS Ground and USPS Priority are not available for this shipment. Try a different address or contact support."
  }
  if (family === "ups_fedex_surfboard") {
    return isNonContiguousUsShipTo(shipTo)
      ? "UPS and FedEx air rates are not available for this Hawaii or Alaska address. Try a different address or contact support."
      : "UPS Ground, 3 Day Select, and UPS Second Day Air are not available for this shipment. Try a different address or contact support."
  }
  if (family === "usps_media_mail") {
    return "USPS Media Mail is not available for this shipment. Try a different address or contact support."
  }
  return "No carrier rates returned for this shipment."
}
