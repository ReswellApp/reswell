import {
  mobileShippingEstimateBodySchema,
  mobileShippingEstimateSchema,
  mobileShippingEstimatorSchema,
  mobileShippingZipSchema,
  type MobileShippingEstimate,
  type MobileShippingEstimator,
  type MobileShippingZip,
} from "@reswell/api-contract"
import { lookupUsZipViaNominatim } from "@/lib/geocode/us-zip-lookup"
import { getGoogleGeocodingApiKey, googleGeocodeUsZip } from "@/lib/maps/google-geocoding-server"
import { EXAMPLE_SURFBOARD_MEASUREMENTS } from "@/lib/shipping/example-surfboard-measurements"
import { getTopSurfboardShippingRates } from "@/lib/services/surfboardShippingEstimate"
import type { MobileApiResult } from "@/lib/services/mobileApi"

function moneyLabel(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount)
}

export function getMobileShippingEstimator(): MobileShippingEstimator {
  return mobileShippingEstimatorSchema.parse({
    title: "Shipping label cost estimator",
    description: "Compare domestic carrier quotes for a packed surfboard. Sign in to see live rates for your lane.",
    presets: EXAMPLE_SURFBOARD_MEASUREMENTS.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      weight_lb: row.weightLb,
      length_in: row.lengthIn,
      width_in: row.widthIn,
      height_in: row.heightIn,
    })),
  })
}

export async function getMobileShippingZip(zip: string): Promise<MobileApiResult<MobileShippingZip>> {
  const five = zip.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) return { ok: false, status: 400, error: "Enter a 5-digit US ZIP code" }

  const nominatim = await lookupUsZipViaNominatim(five)
  if (nominatim) return { ok: true, data: mobileShippingZipSchema.parse(nominatim) }

  if (getGoogleGeocodingApiKey()) {
    const google = await googleGeocodeUsZip(five)
    if (google) {
      return {
        ok: true,
        data: mobileShippingZipSchema.parse({
          postal_code: google.postal_code,
          city_locality: google.city_locality,
          state_province: google.state_province,
          address_line1: google.address_line1,
        }),
      }
    }
  }

  return { ok: false, status: 404, error: "ZIP not found" }
}

export async function postMobileShippingEstimate(
  input: unknown,
): Promise<MobileApiResult<MobileShippingEstimate>> {
  const parsed = mobileShippingEstimateBodySchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, error: "Enter origin and destination ZIPs plus box size and weight." }

  const [origin, destination] = await Promise.all([
    getMobileShippingZip(parsed.data.origin_zip),
    getMobileShippingZip(parsed.data.destination_zip),
  ])
  if (!origin.ok) return { ok: false, status: 400, error: "Could not look up ship-from ZIP — check the code and try again." }
  if (!destination.ok) {
    return { ok: false, status: 400, error: "Could not look up receiver ZIP — check the code and try again." }
  }

  const weightOz = Math.max(1, Math.round(parsed.data.weight_lb * 16))
  const quoted = await getTopSurfboardShippingRates(
    {
      shipFrom: {
        name: "Seller",
        phone: "",
        company_name: "",
        address_line1: origin.data.address_line1 || "100 Main St",
        address_line2: "",
        city_locality: origin.data.city_locality,
        state_province: origin.data.state_province,
        postal_code: origin.data.postal_code,
        country_code: "US",
        residential: "no",
      },
      shipTo: {
        name: "Buyer",
        phone: "555-0100",
        company_name: "",
        address_line1: destination.data.address_line1 || "100 Main St",
        address_line2: "",
        city_locality: destination.data.city_locality,
        state_province: destination.data.state_province,
        postal_code: destination.data.postal_code,
        country_code: "US",
        residential: "yes",
      },
      weightOz,
      lengthIn: parsed.data.length_in,
      widthIn: parsed.data.width_in,
      heightIn: parsed.data.height_in,
    },
    { topN: 20 },
  )
  if (!quoted.ok) return { ok: false, status: 503, error: quoted.error }

  const rates = [...quoted.rates]
    .sort((a, b) => a.totalAmount - b.totalAmount)
    .slice(0, 10)
    .map((rate) => ({
      total_amount: rate.totalAmount,
      total_label: moneyLabel(rate.totalAmount, rate.currency),
      currency: rate.currency,
      carrier_name: rate.carrierName.replace(/®|™/g, "").trim(),
      service_name: rate.serviceName.replace(/®|™/g, "").trim(),
      delivery_days: rate.deliveryDays,
    }))

  return {
    ok: true,
    data: mobileShippingEstimateSchema.parse({
      route_label: `${origin.data.city_locality}, ${origin.data.state_province} (${origin.data.postal_code}) to ${destination.data.city_locality}, ${destination.data.state_province} (${destination.data.postal_code})`,
      rates,
    }),
  }
}
