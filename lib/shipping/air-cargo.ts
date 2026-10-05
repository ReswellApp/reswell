import type { PeerCheckoutShippingRateOption } from "@/lib/shipping/peer-checkout-usps-services"
import type { ShippingPackagingMode } from "@/lib/shipping/packaging-mode"

/**
 * Buyer-facing air cargo for surfboards.
 *
 * The lane is operationally fussy (cargo booking, airport, 48-hour self-pickup,
 * air waybill). Checkout hides that behind one choice and one published price
 * per cargo piece. Reswell books the cargo outside ShipEngine — this is not a
 * parcel label rate.
 *
 * Published at $135 per piece for every surfboard size. Together packaging is
 * one piece. Separate packaging is one piece per board.
 */
export const AIR_CARGO_SERVICE_CODE = "reswell_air_cargo"
export const AIR_CARGO_RATE_ID = "reswell_air_cargo"
export const AIR_CARGO_USD_PER_PIECE = 135
export const AIR_CARGO_PICKUP_WITHIN_HOURS = 48

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

export function airCargoShippingUsd(pieceCount: number): number {
  const pieces = Math.max(1, Math.floor(pieceCount))
  return Math.round(AIR_CARGO_USD_PER_PIECE * pieces * 100) / 100
}

export function buildAirCargoRateOption(pieceCount: number): PeerCheckoutShippingRateOption {
  const pieces = Math.max(1, Math.floor(pieceCount))
  return {
    rateId: AIR_CARGO_RATE_ID,
    serviceCode: AIR_CARGO_SERVICE_CODE,
    serviceName: "Air cargo",
    displayName:
      pieces > 1
        ? `Air cargo — ${pieces} boards, airport pickup`
        : "Air cargo — airport pickup",
    totalAmount: airCargoShippingUsd(pieces),
    deliveryDays: null,
    estimatedDeliveryDate: null,
  }
}

export function appendAirCargoRateOption(
  rates: PeerCheckoutShippingRateOption[],
  pieceCount: number,
): PeerCheckoutShippingRateOption[] {
  if (rates.some((rate) => isAirCargoServiceCode(rate.serviceCode))) return rates
  return [...rates, buildAirCargoRateOption(pieceCount)]
}

export function airCargoPackageRates(
  listingIds: string[],
): AirCargoPackageRate[] {
  const cents = Math.round(AIR_CARGO_USD_PER_PIECE * 100)
  return listingIds.map((listingId) => ({
    listingId,
    rateId: AIR_CARGO_RATE_ID,
    shippingCents: cents,
    serviceCode: AIR_CARGO_SERVICE_CODE,
  }))
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
 * Adds air cargo beside a carrier quote, or offers it alone when the carrier
 * quote fails. Ground stays selected unless the buyer asked for air cargo
 * (or ground rates do not exist).
 */
export function composeAirCargoCheckoutQuote(input: {
  offersAirCargo: boolean
  requestedServiceCode: string | null
  pieceCount: number
  listingIds: string[]
  packagingMode: ShippingPackagingMode
  carrier: CarrierQuoteOk | CarrierQuoteFail
}): ComposedCheckoutShippingQuote | { ok: false; error: string } {
  if (!input.offersAirCargo) {
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

  const airCargoSelected = isAirCargoServiceCode(input.requestedServiceCode)
  const airOption = buildAirCargoRateOption(input.pieceCount)
  const separatePackageRates =
    input.packagingMode === "separate" ? airCargoPackageRates(input.listingIds) : undefined

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
  const availableRates = appendAirCargoRateOption(groundRates, input.pieceCount)

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
