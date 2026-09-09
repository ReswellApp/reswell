import { getBuyerZoneEstimateDestination } from "@/lib/shipping/buyer-zone-estimate-destinations"
import { resolveUsZipShipFrom } from "@/lib/shipping/resolve-us-zip-ship-from"
import {
  getTopSurfboardShippingRates,
  selectCheapestShippingRate,
} from "@/lib/services/surfboardShippingEstimate"
import {
  parseSurfboardShippingTierId,
  surfboardShippingTierFixedParcel,
  type ReswellBuyerEstimateZone,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  resolveSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"

export type BuyerZoneShippingEstimateResult =
  | {
      ok: true
      totalAmount: number
      currency: string
      carrierName: string
      serviceName: string
      sampleCityLabel: string
      tierId: SurfboardShippingTierId
      packBandId: SurfboardShippingPackBandId | null
      zone: ReswellBuyerEstimateZone
    }
  | { ok: false; error: string }

/**
 * Live ShipEngine sample quote for a tier/band carton on a representative zone lane.
 * Closest practical match to checkout pricing without the buyer's real address.
 */
export async function getBuyerZoneShippingEstimate(input: {
  originZip: string
  tierId: string
  packBandId?: string | null
  zone: ReswellBuyerEstimateZone
}): Promise<BuyerZoneShippingEstimateResult> {
  const tierId = parseSurfboardShippingTierId(input.tierId)
  if (!tierId) {
    return { ok: false, error: "Pick a shipping size first." }
  }

  const shipFrom = await resolveUsZipShipFrom(input.originZip)
  if (!shipFrom) {
    return { ok: false, error: "Could not look up that ship-from ZIP." }
  }

  const packBandId = resolveSurfboardShippingPackBandId({
    tierId,
    bandId: input.packBandId,
  })

  const parcel = packBandId
    ? surfboardShippingPackBandFixedParcel(packBandId)
    : surfboardShippingTierFixedParcel(tierId)
  const weightOz = Math.round(parcel.weightLb * 16)

  const destination = getBuyerZoneEstimateDestination(input.zone)

  const rates = await getTopSurfboardShippingRates(
    {
      shipFrom: {
        ...shipFrom,
        country_code: "US",
        residential: shipFrom.residential,
      },
      shipTo: {
        ...destination.shipTo,
        country_code: "US",
        residential: destination.shipTo.residential,
      },
      weightOz,
      lengthIn: parcel.lengthIn,
      widthIn: parcel.widthIn,
      heightIn: parcel.heightIn,
    },
    { topN: 20 },
  )

  if (!rates.ok) {
    return { ok: false, error: rates.error }
  }

  const cheapest = selectCheapestShippingRate(rates.rates)
  if (!cheapest) {
    return { ok: false, error: "No carrier rates returned for this sample lane." }
  }

  return {
    ok: true,
    totalAmount: cheapest.totalAmount,
    currency: cheapest.currency,
    carrierName: cheapest.carrierName,
    serviceName: cheapest.serviceName,
    sampleCityLabel: destination.sampleCityLabel,
    tierId,
    packBandId,
    zone: input.zone,
  }
}
