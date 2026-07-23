import { resolveListingShipFromForRating } from "@/lib/geocoding/resolve-listing-ship-from-for-rating"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  resolveCombinedPackedParcelFromListings,
  resolveSurfboardShippingTierIdFromListing,
  type ListingPackedParcelSource,
  type ResolvedPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"
import {
  surfboardShippingTierUsesUpsParcelLimits,
  validateSurfboardShippingTierParcelLimits,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  filterReswellRatesForPeerSection,
  findPeerCheckoutRateOptionByServiceCode,
  peerCheckoutShippingServiceError,
  type PeerCheckoutShippingRateOption,
  toPeerCheckoutShippingRateOptions,
} from "@/lib/shipping/peer-checkout-usps-services"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/** Minimum listing slice required to rate a Reswell-shipped surfboard at checkout. */
export type ReswellRateableListing = ListingPackedParcelSource & {
  latitude?: number | string | null
  longitude?: number | string | null
  city?: string | null
  state?: string | null
}

export type ReswellListingRateRow = {
  /** Present when ShipEngine returned a label-purchasable rate. */
  rate_id: string | null
  totalAmount: number
  currency: string
  carrierName: string
  carrierCode: string | null
  serviceName: string
  serviceCode: string | null
  deliveryDays: number | null
  attributes: string[]
}

export type ReswellListingRateRequestPayload = {
  rate_options: { carrier_ids: string[] }
  shipment: ReturnType<typeof buildShipmentBody>
}

export type ReswellListingRateOk = {
  ok: true
  cheapest: ReswellListingRateRow
  topRates: ReswellListingRateRow[]
  /** Section-filtered rates buyers may choose at checkout (fins) or the single allowed service (magazines). */
  checkoutRateOptions: PeerCheckoutShippingRateOption[]
  payload: ReswellListingRateRequestPayload
  /** "saved" when the rate uses seller-provided packed dims, "heuristic" when it falls back to board-derived guesses. */
  parcelSource: ResolvedPackedParcelSource
}

export type ReswellListingRateResult =
  | ReswellListingRateOk
  | { ok: false; error: string }

const DEBUG_ENV_FLAG = "RESWELL_SHIPPING_DEBUG"
const CARRIER_IDS_CACHE_TTL_MS = 10 * 60 * 1000

let carrierIdsCache: { ids: string[]; fetchedAt: number } | null = null

function readCachedCarrierIds(): string[] | null {
  if (!carrierIdsCache) return null
  if (Date.now() - carrierIdsCache.fetchedAt > CARRIER_IDS_CACHE_TTL_MS) {
    carrierIdsCache = null
    return null
  }
  return carrierIdsCache.ids
}

function writeCachedCarrierIds(ids: string[]): void {
  carrierIdsCache = { ids, fetchedAt: Date.now() }
}

function isDebugEnabled(): boolean {
  const raw = process.env[DEBUG_ENV_FLAG]?.trim()
  return raw === "1" || raw?.toLowerCase() === "true"
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

async function fetchAllConnectedCarrierIds(): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const cached = readCachedCarrierIds()
  if (cached) {
    return { ok: true, ids: cached }
  }

  let res: Response
  try {
    res = await shipEngineRequest("/carriers")
  } catch (e) {
    console.error("[reswellListingShippingRate] /carriers fetch failed:", e)
    return { ok: false, error: "Could not load carrier accounts. Try again later." }
  }
  if (!res.ok) {
    const data = await parseJsonSafe(res)
    const hint = formatShipEngineApiError(data)
    console.error("[reswellListingShippingRate] /carriers HTTP:", res.status, data)
    return { ok: false, error: hint || "Could not load carrier accounts." }
  }
  const data = await parseJsonSafe(res)
  const ids = extractCarrierIdsFromCarriersResponse(data)
  writeCachedCarrierIds(ids)
  return { ok: true, ids }
}

/**
 * Builds a `ship_from` payload from listing locality (Nominatim forward-geocode) for ShipEngine `/rates`.
 * Same shape the admin rate calculator builds from its address form so both paths land on identical bodies.
 */
async function resolveListingShipFromAddress(
  listing: ReswellRateableListing,
  sellerShipFromName: string,
): Promise<{ ok: true; address: ShippingAddressInput } | { ok: false; error: string }> {
  const parts = await resolveListingShipFromForRating({
    city: listing.city,
    state: listing.state,
    latitude: listing.latitude,
    longitude: listing.longitude,
  })
  if (!parts) {
    return {
      ok: false,
      error: "Seller location is missing — shipping cannot be calculated.",
    }
  }
  const postal = parts.postal_code.length >= 5 ? parts.postal_code.slice(0, 5) : parts.postal_code
  const nameLine = sellerShipFromName.trim().length > 0 ? sellerShipFromName.trim() : "Seller"
  return {
    ok: true,
    address: {
      name: nameLine,
      phone: "",
      company_name: "",
      address_line1: parts.address_line1,
      address_line2: "",
      city_locality: parts.city_locality,
      state_province: parts.state_province,
      postal_code: postal,
      country_code: "US",
      residential: "no",
    },
  }
}

/** Buyer profile row → ShipEngine ship_to with the same shape (and residential flag) admin uses. */
export function buyerProfileAddressToShipTo(
  addr: ProfileAddressRow,
): { ok: true; address: ShippingAddressInput } | { ok: false; error: string } {
  const cc = (addr.country ?? "US").trim().toUpperCase()
  if (cc !== "US") {
    return { ok: false, error: "Only US shipping addresses are supported for this listing." }
  }
  const st = (addr.state ?? "").trim()
  if (!st) {
    return { ok: false, error: "Buyer address is missing a state." }
  }
  const zip = addr.postal_code.trim()
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return { ok: false, error: "A complete US ZIP code is required." }
  }
  return {
    ok: true,
    address: {
      name: addr.full_name.trim() || "Buyer",
      phone: (addr.phone ?? "").trim(),
      company_name: "",
      address_line1: addr.line1.trim(),
      address_line2: (addr.line2 ?? "").trim(),
      city_locality: addr.city.trim(),
      state_province: normalizeUsStateProvinceForShipping("US", st),
      postal_code: zip,
      country_code: "US",
      /** Match admin calculator default (commercial-style quote). */
      residential: "no",
    },
  }
}

function rowFromRate(r: Record<string, unknown>): ReswellListingRateRow {
  const { total, currency } = rateMoneyTotal(r)
  const rateId = typeof r.rate_id === "string" && r.rate_id.trim() ? r.rate_id.trim() : null
  const attrs = Array.isArray(r.rate_attributes)
    ? (r.rate_attributes as string[]).filter((x): x is string => typeof x === "string")
    : []
  const carrierCode = typeof r.carrier_code === "string" && r.carrier_code.trim() ? r.carrier_code.trim() : null
  const serviceCode = typeof r.service_code === "string" && r.service_code.trim() ? r.service_code.trim() : null
  return {
    rate_id: rateId,
    totalAmount: total,
    currency: currency.toUpperCase(),
    carrierName: String(r.carrier_friendly_name ?? r.carrier_code ?? "Carrier"),
    carrierCode,
    serviceName: String(r.service_type ?? r.service_code ?? "Service"),
    serviceCode,
    deliveryDays:
      typeof r.delivery_days === "number" && Number.isFinite(r.delivery_days)
        ? r.delivery_days
        : null,
    attributes: attrs,
  }
}

/**
 * Source of truth for "Reswell shipping" rate calculation against a listing.
 * Used by:
 *   • `/api/checkout/shipping-quote` and `/api/stripe/create-payment-intent` (buyer flow),
 *   • `lib/stripe-complete-order.ts` (server-side amount validation),
 *   • `/api/admin/shipping/quote-listing` (admin diagnostic to confirm checkout matches admin payloads).
 *
 * No checkout-side markup. The number returned IS the cheapest ShipEngine rate for the lane,
 * computed with the same `buildShipmentBody` + `rateMoneyTotal` the admin calculator uses.
 *
 * Set `RESWELL_SHIPPING_DEBUG=1` (server env) to log the exact `/rates` request payload and cheapest row.
 */
export async function getCheapestReswellRateForListing(input: {
  listing: ReswellRateableListing
  shipTo: ShippingAddressInput
  /** Caller may pre-resolve carrier IDs to skip the /carriers round-trip; otherwise we fetch here. */
  carrierIds?: string[]
  /** When set, propagated to `RESWELL_SHIPPING_DEBUG` log for traceability. */
  diagnosticTag?: string
  /** Listing section — restricts USPS services for fins and magazines at checkout. */
  section?: string | null
  /** Buyer-selected ShipEngine rate id from checkout (fins). Ephemeral — prefer {@link selectedServiceCode}. */
  selectedRateId?: string | null
  /** Stable USPS service bucket for fins checkout (e.g. `usps_priority_mail`). */
  selectedServiceCode?: string | null
  /**
   * Ship-from contact name on carrier labels (printed under “Seller” / shipper on the label).
   * Use {@link fetchSellerShipFromLabelName} from the seller’s profile when available.
   */
  sellerShipFromName: string
}): Promise<ReswellListingRateResult> {
  return getCheapestReswellRateForListings({ ...input, listings: [input.listing] })
}

/**
 * One-box rate for multiple same-seller listings shipped together.
 *
 * The combined parcel uses the **biggest item's dimensions** and the **sum of all item weights**
 * (see {@link resolveCombinedPackedParcelFromListings}). Ship-from is resolved from the first
 * listing — all listings belong to one seller, so localities match.
 */
function resolveSelectedCheckoutRate(
  decorated: ReswellListingRateRow[],
  section: string | null | undefined,
  selectedRateId: string | null | undefined,
  selectedServiceCode?: string | null,
): { ok: true; selected: ReswellListingRateRow; checkoutRateOptions: PeerCheckoutShippingRateOption[] } | { ok: false; error: string } {
  const filtered = filterReswellRatesForPeerSection(decorated, section)
  const checkoutRateOptions = toPeerCheckoutShippingRateOptions(filtered, section)

  if (section === "fins" || section === "magazines") {
    if (checkoutRateOptions.length === 0) {
      return { ok: false, error: peerCheckoutShippingServiceError(section) }
    }
  }

  const trimmedSelected = selectedRateId?.trim()
  const trimmedService = selectedServiceCode?.trim()
  if (trimmedSelected || trimmedService) {
    let selectedOption =
      trimmedSelected != null
        ? checkoutRateOptions.find((option) => option.rateId === trimmedSelected) ?? null
        : null

    if (!selectedOption) {
      selectedOption = findPeerCheckoutRateOptionByServiceCode(
        checkoutRateOptions,
        trimmedService,
        section,
      )
    }

    const selectedRow = selectedOption
      ? filtered.find((row) => row.rate_id === selectedOption.rateId) ?? null
      : trimmedSelected
        ? filtered.find((row) => row.rate_id === trimmedSelected) ?? null
        : null

    if (!selectedOption || !selectedRow?.rate_id) {
      return { ok: false, error: "Selected shipping option is no longer available — choose another rate." }
    }
    return { ok: true, selected: selectedRow, checkoutRateOptions }
  }

  const defaultOption = checkoutRateOptions[0]
  const defaultRow = defaultOption
    ? filtered.find((row) => row.rate_id === defaultOption.rateId)
    : null

  const purchasable =
    defaultRow ??
    (section === "fins" || section === "magazines" ? filtered : decorated).find((row) => row.rate_id != null)
  if (!purchasable?.rate_id) {
    return {
      ok: false,
      error:
        section === "fins" || section === "magazines"
          ? peerCheckoutShippingServiceError(section)
          : "No carrier returned a label rate for this shipment. Try again or check ShipEngine.",
    }
  }

  return { ok: true, selected: purchasable, checkoutRateOptions }
}

export async function getCheapestReswellRateForListings(input: {
  listings: ReswellRateableListing[]
  shipTo: ShippingAddressInput
  carrierIds?: string[]
  diagnosticTag?: string
  section?: string | null
  selectedRateId?: string | null
  selectedServiceCode?: string | null
  sellerShipFromName: string
}): Promise<ReswellListingRateResult> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Shipping quotes are temporarily unavailable." }
  }

  const firstListing = input.listings[0]
  if (!firstListing) {
    return { ok: false, error: "No listings to rate for shipping." }
  }

  const parcel = resolveCombinedPackedParcelFromListings(input.listings)
  if (!parcel.ok) {
    return { ok: false, error: parcel.error }
  }

  const weightLb = Math.max(1, parcel.weightOz / 16)
  const dims = {
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
    weightLb,
  }

  const listingTiers = input.listings
    .map((listing) => resolveSurfboardShippingTierIdFromListing(listing))
    .filter((tierId): tierId is SurfboardShippingTierId => tierId != null)
  const usesFreightTier = listingTiers.some((tierId) => !surfboardShippingTierUsesUpsParcelLimits(tierId))

  if (usesFreightTier) {
    for (const tierId of listingTiers) {
      const tierCheck = validateSurfboardShippingTierParcelLimits(tierId, dims)
      if (!tierCheck.ok) {
        return tierCheck
      }
    }
  } else if (listingTiers.length > 0) {
    for (const tierId of listingTiers) {
      const tierCheck = validateSurfboardShippingTierParcelLimits(tierId, dims)
      if (!tierCheck.ok) {
        return tierCheck
      }
    }
    const limitCheck = validateSurfboardLabelParcelLimits(dims)
    if (!limitCheck.ok) {
      return limitCheck
    }
  } else {
    const limitCheck = validateSurfboardLabelParcelLimits(dims)
    if (!limitCheck.ok) {
      return limitCheck
    }
  }

  const shipFrom = await resolveListingShipFromAddress(firstListing, input.sellerShipFromName)
  if (!shipFrom.ok) {
    return { ok: false, error: shipFrom.error }
  }

  let carrierIds = input.carrierIds?.filter(Boolean) ?? []
  if (carrierIds.length === 0) {
    const carriersResult = await fetchAllConnectedCarrierIds()
    if (!carriersResult.ok) {
      return { ok: false, error: carriersResult.error }
    }
    carrierIds = carriersResult.ids
  }
  if (carrierIds.length === 0) {
    return { ok: false, error: "No shipping carriers are configured yet." }
  }

  const payload: ReswellListingRateRequestPayload = {
    rate_options: { carrier_ids: carrierIds },
    shipment: buildShipmentBody(shipFrom.address, input.shipTo, {
      weightValue: parcel.weightOz,
      weightUnit: "ounce",
      length: parcel.lengthIn,
      width: parcel.widthIn,
      height: parcel.heightIn,
      dimUnit: "inch",
      packageCode: "package",
      validateAddress: "no_validation",
    }),
  }

  if (isDebugEnabled()) {
    console.info(
      "[reswellListingShippingRate] /rates payload:",
      JSON.stringify({ tag: input.diagnosticTag ?? null, payload }, null, 2),
    )
  }

  let res: Response
  try {
    res = await shipEngineRequest("/rates", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error("[reswellListingShippingRate] /rates request failed:", e)
    return { ok: false, error: "Could not reach the shipping rate service." }
  }
  const raw = await parseJsonSafe(res)
  if (!res.ok) {
    const hint = formatShipEngineApiError(raw)
    console.error("[reswellListingShippingRate] /rates HTTP:", res.status, raw)
    return { ok: false, error: hint.trim() || "ShipEngine did not return rates for this package." }
  }

  const rates = extractRatesFromApiEnvelope(raw)
  const decorated = rates
    .map(rowFromRate)
    .filter((row) => Number.isFinite(row.totalAmount) && row.totalAmount >= 0)

  if (decorated.length === 0) {
    const emptyHint = formatShipEngineApiError(raw)
    console.error("[reswellListingShippingRate] /rates empty:", { hint: emptyHint, raw })
    return {
      ok: false,
      error: emptyHint.trim() || "No carrier rates returned for this shipment.",
    }
  }

  decorated.sort((a, b) => a.totalAmount - b.totalAmount)

  const section =
    input.section?.trim() ||
    (input.listings[0] as { section?: string | null } | undefined)?.section?.trim() ||
    null

  const resolved = resolveSelectedCheckoutRate(
    decorated,
    section,
    input.selectedRateId,
    input.selectedServiceCode,
  )
  if (!resolved.ok) {
    return resolved
  }

  const cheapest = resolved.selected

  if (isDebugEnabled()) {
    console.info(
      "[reswellListingShippingRate] cheapest row:",
      JSON.stringify(
        {
          tag: input.diagnosticTag ?? null,
          section,
          cheapest,
          checkoutRateOptions: resolved.checkoutRateOptions,
          top: decorated.slice(0, 5),
        },
        null,
        2,
      ),
    )
  }

  if (cheapest.currency && cheapest.currency.toUpperCase() !== "USD") {
    return { ok: false, error: "Unsupported currency from carrier quote." }
  }

  return {
    ok: true,
    cheapest,
    topRates: decorated,
    checkoutRateOptions: resolved.checkoutRateOptions,
    payload,
    parcelSource: parcel.source,
  }
}
