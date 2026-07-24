import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  parseSurfboardShippingTierId,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"

/** BoardShipper 2026 flat-rate destination zones (from rate sheet). */
export type BoardShipperZone =
  | "california"
  | "or_wa_co"
  | "hawaii"
  | "rest_of_us"
  | "canada"
  | "europe"
  | "international"

export const BOARDSHIPPER_ZONE_LABELS: Record<BoardShipperZone, string> = {
  california: "California",
  or_wa_co: "Oregon / Washington / Colorado",
  hawaii: "Hawaii",
  rest_of_us: "Rest of US",
  canada: "Canada",
  europe: "Europe",
  international: "International",
}

/** USD flat rates by tier × zone (BoardShipper 2026). */
export const BOARDSHIPPER_FLAT_RATES_USD: Record<
  SurfboardShippingTierId,
  Record<BoardShipperZone, number | null>
> = {
  shortboard: {
    california: 55,
    or_wa_co: 75,
    hawaii: 175,
    rest_of_us: 95,
    canada: 110,
    europe: 325,
    international: null,
  },
  midlength: {
    california: 95,
    or_wa_co: 110,
    hawaii: 195,
    rest_of_us: 215,
    canada: 215,
    europe: 450,
    international: null,
  },
  longboard: {
    california: 155,
    or_wa_co: 175,
    hawaii: 300,
    rest_of_us: 350,
    canada: 350,
    europe: 600,
    international: null,
  },
}

const EUROPE_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "UK",
  "NO",
  "CH",
  "IS",
])

function normalizeCountryCode(country: string): string {
  const trimmed = country.trim().toUpperCase()
  if (trimmed === "UNITED STATES" || trimmed === "USA" || trimmed === "U.S." || trimmed === "U.S.A.") {
    return "US"
  }
  if (trimmed === "UNITED KINGDOM" || trimmed === "GREAT BRITAIN") {
    return "GB"
  }
  if (trimmed.length === 2) return trimmed
  return trimmed
}

/** Maps a buyer ship-to address to a BoardShipper zone. */
export function resolveBoardShipperZone(input: {
  country: string
  state: string | null
}): BoardShipperZone {
  const country = normalizeCountryCode(input.country)
  if (country === "US") {
    const state = normalizeUsStateProvinceForShipping(country, input.state?.trim() ?? "")
    if (state === "CA") return "california"
    if (state === "HI") return "hawaii"
    if (state === "OR" || state === "WA" || state === "CO") return "or_wa_co"
    return "rest_of_us"
  }
  if (country === "CA") return "canada"
  if (EUROPE_COUNTRY_CODES.has(country)) return "europe"
  return "international"
}

export function getBoardShipperFlatRateUsd(
  tierId: SurfboardShippingTierId,
  zone: BoardShipperZone,
): number | null {
  return BOARDSHIPPER_FLAT_RATES_USD[tierId][zone] ?? null
}

/** Lowest contiguous-US rate for a tier (California) — useful for “from $X” copy. */
export function boardShipperFlatRateFromUsd(tierId: SurfboardShippingTierId): number {
  return getBoardShipperFlatRateUsd(tierId, "california") ?? 0
}

export function listingUsesBoardShipperFlatRates(listing: {
  board_shipping_cost_mode?: string | null
  shipping_package_tier?: string | null
}): boolean {
  if (listing.board_shipping_cost_mode?.trim() !== "flat") return false
  return parseSurfboardShippingTierId(listing.shipping_package_tier) != null
}

export function quoteBoardShipperFlatShippingUsd(input: {
  tierId: SurfboardShippingTierId
  buyerAddress: Pick<ProfileAddressRow, "country" | "state">
}):
  | { ok: true; shippingUsd: number; zone: BoardShipperZone; zoneLabel: string }
  | { ok: false; error: string } {
  const zone = resolveBoardShipperZone({
    country: input.buyerAddress.country,
    state: input.buyerAddress.state,
  })
  const rate = getBoardShipperFlatRateUsd(input.tierId, zone)
  if (rate == null) {
    return {
      ok: false,
      error:
        "BoardShipper international quotes require a custom rate. Contact support or ask the seller about shipping to your country.",
    }
  }
  return {
    ok: true,
    shippingUsd: rate,
    zone,
    zoneLabel: BOARDSHIPPER_ZONE_LABELS[zone],
  }
}
