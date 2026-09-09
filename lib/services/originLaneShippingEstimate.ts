import { getOriginLaneDestinations } from "@/lib/shipping/origin-lane-destinations"
import { resolveUsZipShipFrom } from "@/lib/shipping/resolve-us-zip-ship-from"
import {
  getTopSurfboardShippingRates,
  selectCheapestShippingRate,
} from "@/lib/services/surfboardShippingEstimate"
import type {
  OriginLaneQuote,
  OriginLaneShippingEstimateInput,
} from "@/lib/validations/origin-lane-shipping-estimate"

export type { OriginLaneQuote }

export type OriginLaneShippingEstimateResult =
  | {
      ok: true
      originLabel: string
      inState: OriginLaneQuote | null
      crossCountry: OriginLaneQuote | null
    }
  | { ok: false; error: string }

function originLabel(shipFrom: {
  city_locality: string
  state_province: string
  postal_code: string
}): string {
  const city = shipFrom.city_locality.trim()
  const state = shipFrom.state_province.trim()
  const zip = shipFrom.postal_code.trim()
  if (city && state && zip) return `${city}, ${state} (${zip})`
  if (zip) return zip
  return "your ZIP"
}

async function quoteLane(
  input: OriginLaneShippingEstimateInput,
  shipFrom: Awaited<ReturnType<typeof resolveUsZipShipFrom>>,
  destination: ReturnType<typeof getOriginLaneDestinations>["inState"],
): Promise<OriginLaneQuote | null> {
  if (!shipFrom) return null
  const rates = await getTopSurfboardShippingRates(
    {
      shipFrom: { ...shipFrom, country_code: "US" },
      shipTo: { ...destination.shipTo, country_code: "US" },
      weightOz: input.weightOz,
      lengthIn: input.lengthIn,
      widthIn: input.widthIn,
      heightIn: input.heightIn,
    },
    { topN: 20 },
  )
  if (!rates.ok) return null
  const cheapest = selectCheapestShippingRate(rates.rates)
  if (!cheapest) return null
  return {
    totalAmount: cheapest.totalAmount,
    currency: cheapest.currency,
    carrierName: cheapest.carrierName,
    serviceName: cheapest.serviceName,
    sampleCityLabel: destination.sampleCityLabel,
  }
}

/**
 * Live ShipEngine sample quotes from one ship-from ZIP to an in-state city
 * and a cross-country city. Closest practical match without a buyer ZIP.
 */
export async function getOriginLaneShippingEstimate(
  input: OriginLaneShippingEstimateInput,
): Promise<OriginLaneShippingEstimateResult> {
  const shipFrom = await resolveUsZipShipFrom(input.originZip)
  if (!shipFrom) {
    return { ok: false, error: "Could not look up that ship-from ZIP." }
  }

  const destinations = getOriginLaneDestinations(shipFrom)
  const [inState, crossCountry] = await Promise.all([
    quoteLane(input, shipFrom, destinations.inState),
    quoteLane(input, shipFrom, destinations.crossCountry),
  ])

  if (!inState && !crossCountry) {
    return { ok: false, error: "No carrier rates returned for these sample lanes." }
  }

  return {
    ok: true,
    originLabel: originLabel(shipFrom),
    inState,
    crossCountry,
  }
}
