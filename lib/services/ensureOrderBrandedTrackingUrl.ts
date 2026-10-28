import type { SupabaseClient } from "@supabase/supabase-js"
import {
  brandedTrackingCountrySupported,
  createBrandedTrackingPageForShipment,
  type BrandedTrackingLocality,
} from "@/lib/shipengine/branded-tracking-page"
import { normalizeBrandedTrackingUrl } from "@/lib/utils/branded-tracking-url"
import { getReswellWarehouseAddress } from "@/lib/reswell-warehouse-address"
import { fetchSantaBarbaraDropoffOrderIds } from "@/lib/services/santaBarbaraDropoffOrderAccess"
import { resolveSellerShipFromAddress } from "@/lib/services/sellerShipFromAddress"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import {
  orderShippingJsonToRateQuoteAddress,
  profileRowToRateQuoteAddress,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import { getShipEngineBrandedTrackingThemeGuid } from "@/lib/shipengine/config"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type OrderBrandedTrackingRow = {
  id: string
  seller_id: string
  tracking_number: string | null
  tracking_carrier: string | null
  shipping_address: unknown
}

function isMissingBrandedTrackingColumn(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("branded_tracking_url") || lower.includes("branded_tracking_number")
}

function localityFromRateAddress(address: RateQuoteAddressFields): BrandedTrackingLocality | null {
  const cityLocality = address.city_locality.trim()
  const stateProvince = address.state_province.trim()
  const postalCode = address.postal_code.trim()
  const countryCode = address.country_code.trim()
  if (!cityLocality || !stateProvince || !postalCode || !countryCode) return null
  if (!brandedTrackingCountrySupported(countryCode)) return null
  return { cityLocality, stateProvince, postalCode, countryCode }
}

/**
 * Creates the ShipEngine branded tracking page for this order's current tracking
 * number and stores the URL. Safe to call on every scan: a matching stored URL
 * is returned without another API call.
 */
export async function ensureOrderBrandedTrackingUrl(orderId: string): Promise<string | null> {
  const id = orderId.trim()
  if (!id) return null

  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error("[branded-tracking] service role unavailable", {
      message: error instanceof Error ? error.message : "missing service role",
    })
    return null
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, seller_id, tracking_number, tracking_carrier, shipping_address")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[branded-tracking] order load:", error.message)
    return null
  }

  const order = data as OrderBrandedTrackingRow
  const trackingNumber = normalizeTrackingNumberForCarrier(order.tracking_number ?? "")
  if (!trackingNumber) return null

  const stored = await supabase
    .from("orders")
    .select("branded_tracking_url, branded_tracking_number")
    .eq("id", id)
    .maybeSingle()

  let canPersist = true
  if (stored.error) {
    canPersist = !isMissingBrandedTrackingColumn(stored.error.message)
    console.error("[branded-tracking] stored url load", {
      orderId: id,
      missingColumns: !canPersist,
      message: stored.error.message.slice(0, 200),
    })
  } else {
    const storedRow = stored.data as {
      branded_tracking_url?: string | null
      branded_tracking_number?: string | null
    } | null
    const storedNumber = normalizeTrackingNumberForCarrier(storedRow?.branded_tracking_number ?? "")
    const storedUrl = normalizeBrandedTrackingUrl(storedRow?.branded_tracking_url)
    if (storedUrl && storedNumber === trackingNumber) return storedUrl
  }

  if (!getShipEngineBrandedTrackingThemeGuid()) {
    console.error("[branded-tracking] theme guid unset", { orderId: id })
    return null
  }

  const shipTo = orderShippingJsonToRateQuoteAddress(order.shipping_address)
  const to = shipTo ? localityFromRateAddress(shipTo) : null
  if (!to) {
    console.error("[branded-tracking] ship-to incomplete", { orderId: id })
    return null
  }

  const dropoffIds = await fetchSantaBarbaraDropoffOrderIds(supabase, [id])
  let fromAddress: RateQuoteAddressFields | null = null
  if (dropoffIds.has(id)) {
    fromAddress = getReswellWarehouseAddress()
  } else {
    const sellerFrom = await resolveSellerShipFromAddress(supabase, order.seller_id)
    fromAddress = sellerFrom.ok ? profileRowToRateQuoteAddress(sellerFrom.address) : null
  }
  const from =
    (fromAddress ? localityFromRateAddress(fromAddress) : null) ??
    localityFromRateAddress(getReswellWarehouseAddress())
  if (!from) {
    console.error("[branded-tracking] ship-from incomplete", { orderId: id })
    return null
  }

  const url = await createBrandedTrackingPageForShipment({
    trackingNumber,
    trackingCarrier: order.tracking_carrier,
    shipTo: to,
    shipFrom: from,
  })
  if (!url) return null
  if (!canPersist) return url

  const { error: writeErr } = await supabase
    .from("orders")
    .update({
      branded_tracking_url: url,
      branded_tracking_number: trackingNumber,
    })
    .eq("id", id)

  if (writeErr) {
    console.error("[branded-tracking] save url", {
      orderId: id,
      missingColumns: isMissingBrandedTrackingColumn(writeErr.message),
      message: writeErr.message.slice(0, 200),
    })
  }

  return url
}

/**
 * ShipEngine branded portal for this order. Used by the track redirect so older
 * messages are not stuck on a saved carrier URL. Never returns UPS/USPS/FedEx.
 */
export async function resolveOrderPackageTrackingUrl(orderId: string): Promise<string | null> {
  return ensureOrderBrandedTrackingUrl(orderId)
}
