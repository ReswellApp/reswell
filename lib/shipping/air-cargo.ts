import type { PeerCheckoutShippingRateOption } from "@/lib/shipping/peer-checkout-usps-services"
import type { ShippingPackagingMode } from "@/lib/shipping/packaging-mode"

/**
 * Buyer-facing air cargo for surfboards.
 *
 * The choice is simple. The price is not. A cargo quote is a lane: seller origin,
 * destination airport, and the packed piece (length, girth, weight). The same
 * board is a different price to HNL than to SAN, and a longboard is a different
 * piece than a shortboard. There is no flat fee.
 *
 * Checkout may offer air cargo only when `airCargoQuoteUsd` is a real total for
 * that shipment. Until a lane quote exists, the option is omitted and payment
 * must not invent one.
 *
 * Reswell books cargo outside ShipEngine parcel labels.
 */
export const AIR_CARGO_SERVICE_CODE = "reswell_air_cargo"
export const AIR_CARGO_RATE_ID = "reswell_air_cargo"
export const AIR_CARGO_PICKUP_WITHIN_HOURS = 48

export const AIR_CARGO_UNPRICED_ERROR =
  "Air cargo for this route isn't priced yet. Choose ground delivery, or try another airport."

export type AirCargoPackageRate = {
  listingId: string
  rateId: string
  shippingCents: number
  serviceCode?: string | null
}

export function isAirCargoServiceCode(code: string | null | undefined): boolean {
  return (code ?? "").trim().toLowerCase() === AIR_CARGO_SERVICE_CODE
}

/** Together (or a single board) is one cargo piece. Separate is one piece per listing. */
export function airCargoPieceCount(input: {
  packagingMode: ShippingPackagingMode
  listingCount: number
}): number {
  if (input.packagingMode === "separate") {
    return Math.max(1, Math.floor(input.listingCount))
  }
  return 1
}

/** Whole-shipment cargo total. Null when this lane has not been quoted. */
export function parseAirCargoQuoteUsd(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100) / 100
}

export function buildAirCargoRateOption(input: {
  totalUsd: number
  pieceCount: number
}): PeerCheckoutShippingRateOption {
  const pieces = Math.max(1, Math.floor(input.pieceCount))
  return {
    rateId: AIR_CARGO_RATE_ID,
    serviceCode: AIR_CARGO_SERVICE_CODE,
    serviceName: "Air cargo",
    displayName:
      pieces > 1
        ? `Air cargo — ${pieces} boards, airport pickup`
        : "Air cargo — airport pickup",
    totalAmount: input.totalUsd,
    deliveryDays: null,
    estimatedDeliveryDate: null,
  }
}

export function appendAirCargoRateOption(
  rates: PeerCheckoutShippingRateOption[],
  option: PeerCheckoutShippingRateOption,
): PeerCheckoutShippingRateOption[] {
  if (rates.some((rate) => isAirCargoServiceCode(rate.serviceCode))) return rates
  return [...rates, option]
}

/** Split a shipment total across separate boards. Remainder cents stay on the first piece. */
export function airCargoPackageRates(
  listingIds: string[],
  totalUsd: number,
): AirCargoPackageRate[] {
  const totalCents = Math.round(totalUsd * 100)
  const count = Math.max(1, listingIds.length)
  const base = Math.floor(totalCents / count)
  let remainder = totalCents - base * count
  return listingIds.map((listingId) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder -= 1
    return {
      listingId,
      rateId: AIR_CARGO_RATE_ID,
      shippingCents: base + extra,
      serviceCode: AIR_CARGO_SERVICE_CODE,
    }
  })
}

type CarrierQuoteOk = {
  ok: true
  shippingUsd: number
  usedReswellQuote: boolean
  selectedRate: { rateId: string; serviceCode: string; serviceName: string } | null
  availableRates: PeerCheckoutShippingRateOption[] | null
  packageRates?: AirCargoPackageRate[] | null
}

type CarrierQuoteFail = { ok: false; error: string }

export type ComposedCheckoutShippingQuote = {
  ok: true
  shippingUsd: number
  usedReswellQuote: boolean
  selectedRate: { rateId: string; serviceCode: string; serviceName: string } | null
  availableRates: PeerCheckoutShippingRateOption[] | null
  packageRates?: AirCargoPackageRate[]
  /** Live ground total, still shown when air cargo is the selected method. */
  groundShippingUsd: number | null
  /** Set when carrier delivery cannot be quoted and air cargo is the way through. */
  groundUnavailableReason: string | null
}

/**
 * Adds a quoted air cargo total beside ground rates.
 * Without `airCargoQuoteUsd`, air cargo is left off the quote. A failed ground
 * quote is not replaced with a made-up cargo price.
 */
export function composeAirCargoCheckoutQuote(input: {
  offersAirCargo: boolean
  /** Total USD for this origin, airport, and packed shipment. Null when unknown. */
  airCargoQuoteUsd?: number | null
  requestedServiceCode: string | null
  pieceCount: number
  listingIds: string[]
  packagingMode: ShippingPackagingMode
  carrier: CarrierQuoteOk | CarrierQuoteFail
}): ComposedCheckoutShippingQuote | { ok: false; error: string } {
  const airCargoQuoteUsd = input.offersAirCargo ? parseAirCargoQuoteUsd(input.airCargoQuoteUsd) : null
  const airCargoSelected = isAirCargoServiceCode(input.requestedServiceCode)

  if (airCargoQuoteUsd == null) {
    if (airCargoSelected) return { ok: false, error: AIR_CARGO_UNPRICED_ERROR }
    if (!input.carrier.ok) return { ok: false, error: input.carrier.error }
    return {
      ok: true,
      shippingUsd: input.carrier.shippingUsd,
      usedReswellQuote: input.carrier.usedReswellQuote,
      selectedRate: input.carrier.selectedRate,
      availableRates: input.carrier.availableRates,
      packageRates: input.carrier.packageRates ?? undefined,
      groundShippingUsd: input.carrier.usedReswellQuote ? input.carrier.shippingUsd : null,
      groundUnavailableReason: null,
    }
  }

  const airOption = buildAirCargoRateOption({
    totalUsd: airCargoQuoteUsd,
    pieceCount: input.pieceCount,
  })
  const separatePackageRates =
    input.packagingMode === "separate"
      ? airCargoPackageRates(input.listingIds, airCargoQuoteUsd)
      : undefined

  if (!input.carrier.ok) {
    return {
      ok: true,
      shippingUsd: airOption.totalAmount,
      usedReswellQuote: true,
      selectedRate: {
        rateId: airOption.rateId,
        serviceCode: airOption.serviceCode,
        serviceName: airOption.serviceName,
      },
      availableRates: [airOption],
      packageRates: separatePackageRates,
      groundShippingUsd: null,
      groundUnavailableReason: input.carrier.error,
    }
  }

  if (!input.carrier.usedReswellQuote) {
    if (airCargoSelected) {
      return { ok: false, error: "Air cargo isn't available for this shipment." }
    }
    return {
      ok: true,
      shippingUsd: input.carrier.shippingUsd,
      usedReswellQuote: false,
      selectedRate: input.carrier.selectedRate,
      availableRates: input.carrier.availableRates,
      packageRates: input.carrier.packageRates ?? undefined,
      groundShippingUsd: null,
      groundUnavailableReason: null,
    }
  }

  const groundRates = input.carrier.availableRates ?? []
  const availableRates = appendAirCargoRateOption(groundRates, airOption)

  if (!airCargoSelected) {
    return {
      ok: true,
      shippingUsd: input.carrier.shippingUsd,
      usedReswellQuote: true,
      selectedRate: input.carrier.selectedRate,
      availableRates,
      packageRates: input.carrier.packageRates ?? undefined,
      groundShippingUsd: input.carrier.shippingUsd,
      groundUnavailableReason: null,
    }
  }

  return {
    ok: true,
    shippingUsd: airOption.totalAmount,
    usedReswellQuote: true,
    selectedRate: {
      rateId: airOption.rateId,
      serviceCode: airOption.serviceCode,
      serviceName: airOption.serviceName,
    },
    availableRates,
    packageRates: separatePackageRates ?? input.carrier.packageRates ?? undefined,
    groundShippingUsd: input.carrier.shippingUsd,
    groundUnavailableReason: null,
  }
}

export function applyAirCargoToOrderShippingJson(
  existing: Record<string, unknown> | null,
  airport: string,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    air_cargo: {
      airport,
      service_code: AIR_CARGO_SERVICE_CODE,
      pickup_within_hours: AIR_CARGO_PICKUP_WITHIN_HOURS,
    },
  }
}

export function readOrderAirCargo(
  shippingAddress: unknown,
): { airport: string; pickupWithinHours: number } | null {
  if (shippingAddress == null || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
    return null
  }
  const raw = (shippingAddress as Record<string, unknown>).air_cargo
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null
  const airport = (raw as Record<string, unknown>).airport
  if (typeof airport !== "string" || airport.trim().length < 3) return null
  const hoursRaw = (raw as Record<string, unknown>).pickup_within_hours
  const pickupWithinHours =
    typeof hoursRaw === "number" && Number.isFinite(hoursRaw) && hoursRaw > 0
      ? Math.round(hoursRaw)
      : AIR_CARGO_PICKUP_WITHIN_HOURS
  return { airport: airport.trim(), pickupWithinHours }
}
