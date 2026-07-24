import { lookupUsZipViaNominatim } from "@/lib/geocode/us-zip-lookup"
import { getGoogleGeocodingApiKey, googleGeocodeUsZip } from "@/lib/maps/google-geocoding-server"
import { getBuyerZoneEstimateDestination } from "@/lib/shipping/buyer-zone-estimate-destinations"
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
import type { AddressFields } from "@/app/admin/shipping/address-fields"

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

async function resolveOriginFromZip(zip: string): Promise<AddressFields | null> {
  const five = zip.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) return null

  const nominatim = await lookupUsZipViaNominatim(five)
  if (nominatim?.city_locality && nominatim.state_province && nominatim.postal_code) {
    return {
      name: "Seller",
      phone: "",
      company_name: "",
      address_line1: nominatim.address_line1 ?? "100 Main St",
      address_line2: "",
      city_locality: nominatim.city_locality,
      state_province: nominatim.state_province,
      postal_code: nominatim.postal_code,
      country_code: "US",
      residential: "no",
    }
  }

  if (getGoogleGeocodingApiKey()) {
    const g = await googleGeocodeUsZip(five)
    if (g) {
      return {
        name: "Seller",
        phone: "",
        company_name: "",
        address_line1: g.address_line1 ?? "100 Main St",
        address_line2: "",
        city_locality: g.city_locality,
        state_province: g.state_province,
        postal_code: g.postal_code,
        country_code: "US",
        residential: "no",
      }
    }
  }

  return null
}

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

  const shipFrom = await resolveOriginFromZip(input.originZip)
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
