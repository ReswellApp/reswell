import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { ReswellListingRateRow } from "@/lib/services/reswellListingShippingRate"

/** ShipEngine service codes allowed for peer checkout by product section. */
export const PEER_CHECKOUT_USPS_SERVICE_CODES: Partial<
  Record<PeerListingSection, readonly string[]>
> = {
  fins: ["usps_ground_advantage", "usps_parcel_select", "usps_priority_mail"],
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

export function peerCheckoutSectionRestrictsUspsServices(
  section: string | null | undefined,
): section is PeerListingSection {
  return (
    section === "fins" ||
    section === "magazines"
  )
}

export function peerCheckoutOffersShippingRateChoice(
  section: string | null | undefined,
): boolean {
  return section === "fins"
}

export function filterReswellRatesForPeerSection(
  rates: ReswellListingRateRow[],
  section: string | null | undefined,
): ReswellListingRateRow[] {
  if (!peerCheckoutSectionRestrictsUspsServices(section)) {
    return rates
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
      return {
        rateId: row.rate_id,
        serviceCode,
        serviceName: row.serviceName,
        displayName:
          PEER_CHECKOUT_USPS_DISPLAY_NAMES[serviceCode] ??
          (row.serviceName.trim() || "USPS"),
        totalAmount: row.totalAmount,
        deliveryDays: row.deliveryDays,
      }
    })

  if (section === "fins") {
    options.sort((a, b) => {
      const order = finServiceSortKey(a.serviceCode) - finServiceSortKey(b.serviceCode)
      if (order !== 0) return order
      return a.totalAmount - b.totalAmount
    })
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

export function peerCheckoutShippingServiceError(section: string | null | undefined): string {
  if (section === "fins") {
    return "USPS Ground and USPS Priority are not available for this shipment. Try a different address or contact support."
  }
  if (section === "magazines") {
    return "USPS Media Mail is not available for this shipment. Try a different address or contact support."
  }
  return "No carrier rates returned for this shipment."
}
