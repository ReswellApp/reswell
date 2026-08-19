import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { insertAdminUserShippingLabel } from "@/lib/db/adminUserShippingLabels"
import { startStaffOutboundMarketplaceConversation } from "@/lib/services/adminStartMarketplaceConversation"
import { purchaseLabelWithRateId } from "@/lib/services/orderShippingLabel"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  fetchShipEngineRatesForSurfboard,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import { profileRowToRateQuoteAddress, type RateQuoteAddressFields } from "@/lib/shipping/rate-address"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import type { AdminUserShippingLabelShipTo } from "@/lib/validations/adminUserShippingLabel"
import type { ProfileAddressRow } from "@/lib/profile-address"

export type AdminUserLabelAddressOption = {
  id: string
  label: string
  oneLine: string
  isDefault: boolean
  fields: RateQuoteAddressFields
}

export type AdminUserLabelContext = {
  shipEngineConfigured: boolean
  user: {
    id: string
    display_name: string | null
    email: string | null
    avatar_url: string | null
  }
  addresses: AdminUserLabelAddressOption[]
  shipFrom: {
    name: string
    oneLine: string
    fields: RateQuoteAddressFields
  }
}

export const RESWELL_SHIP_FROM: RateQuoteAddressFields = {
  name: "Reswell",
  phone: "",
  company_name: "Reswell",
  address_line1: "915 De La Vina",
  address_line2: "",
  city_locality: "Santa Barbara",
  state_province: "CA",
  postal_code: "93101",
  country_code: "US",
  residential: "no",
}

function formatAddressOneLine(a: RateQuoteAddressFields): string {
  return [a.address_line1, [a.city_locality, a.state_province, a.postal_code].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ")
}

function shipToToRateQuoteAddress(shipTo: AdminUserShippingLabelShipTo): RateQuoteAddressFields {
  return {
    name: shipTo.name,
    phone: shipTo.phone,
    company_name: shipTo.company_name,
    address_line1: shipTo.address_line1,
    address_line2: shipTo.address_line2,
    city_locality: shipTo.city_locality,
    state_province: shipTo.state_province,
    postal_code: shipTo.postal_code,
    country_code: shipTo.country_code,
    residential: shipTo.residential,
  }
}

function resolveReswellShipFrom(): RateQuoteAddressFields {
  return RESWELL_SHIP_FROM
}

function buildPackageOnTheWayMessage(params: {
  trackingNumber: string
  trackingCarrier: string | null
}): string {
  const carrier = params.trackingCarrier?.trim() || null
  const trackUrl = carrierTrackingUrl(params.trackingNumber, carrier)
  return [
    "Your package is on the way from Reswell.",
    "",
    carrier ? `Carrier: ${carrier}` : null,
    `Tracking #: ${params.trackingNumber}`,
    trackUrl ? `Track it here: ${trackUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join("\n")
}

export async function loadAdminUserLabelContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; data: AdminUserLabelContext } | { ok: false; error: string; status: number }> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[loadAdminUserLabelContext] profile:", profileErr)
    return { ok: false, error: "Could not load user", status: 500 }
  }
  if (!profile?.id) {
    return { ok: false, error: "User not found", status: 404 }
  }

  const { addresses, error: addrErr } = await fetchProfileAddresses(supabase, userId)
  if (addrErr) {
    console.error("[loadAdminUserLabelContext] addresses:", addrErr)
    return { ok: false, error: "Could not load saved addresses", status: 500 }
  }

  const shipFromFields = await resolveReswellShipFrom()

  return {
    ok: true,
    data: {
      shipEngineConfigured: isShipEngineConfigured(),
      user: {
        id: profile.id,
        display_name: profile.display_name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
      },
      addresses: addresses.map((row: ProfileAddressRow) => {
        const fields = profileRowToRateQuoteAddress(row)
        return {
          id: row.id,
          label: row.label?.trim() || (row.is_default ? "Default" : "Address"),
          oneLine: formatAddressOneLine(fields),
          isDefault: row.is_default,
          fields,
        }
      }),
      shipFrom: {
        name: shipFromFields.company_name || shipFromFields.name || "Reswell",
        oneLine: formatAddressOneLine(shipFromFields),
        fields: shipFromFields,
      },
    },
  }
}

export async function quoteAdminUserShippingLabelRates(params: {
  supabase: SupabaseClient
  userId: string
  parcel: { length_in: number; width_in: number; height_in: number; weight_lb: number }
  shipTo: AdminUserShippingLabelShipTo
}): Promise<
  | { ok: true; rates: ShipEngineRateOption[] }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured (missing SHIPENGINE_API_KEY).", status: 503 }
  }

  const { data: profile, error: profileErr } = await params.supabase
    .from("profiles")
    .select("id")
    .eq("id", params.userId)
    .maybeSingle()
  if (profileErr) {
    console.error("[quoteAdminUserShippingLabelRates] profile:", profileErr)
    return { ok: false, error: "Could not load user", status: 500 }
  }
  if (!profile?.id) {
    return { ok: false, error: "User not found", status: 404 }
  }

  const parcelCheck = validateLabelParcelEntry({
    lengthIn: params.parcel.length_in,
    widthIn: params.parcel.width_in,
    heightIn: params.parcel.height_in,
    weightLb: params.parcel.weight_lb,
  })
  if (!parcelCheck.ok) {
    return { ok: false, error: parcelCheck.error, status: 422 }
  }

  const shipFrom = await resolveReswellShipFrom()
  const quoted = await fetchShipEngineRatesForSurfboard({
    shipFrom,
    shipTo: shipToToRateQuoteAddress(params.shipTo),
    parcel: {
      lengthIn: params.parcel.length_in,
      widthIn: params.parcel.width_in,
      heightIn: params.parcel.height_in,
      weightLb: params.parcel.weight_lb,
    },
  })
  if (!quoted.ok) {
    return quoted
  }
  return { ok: true, rates: quoted.rates }
}

export async function purchaseAdminUserShippingLabel(params: {
  supabase: SupabaseClient
  staffUserId: string
  userId: string
  rateId: string
  parcel: { length_in: number; width_in: number; height_in: number; weight_lb: number }
  shipTo: AdminUserShippingLabelShipTo
}): Promise<
  | {
      ok: true
      labelUrl: string | null
      trackingNumber: string
      trackingCarrier: string | null
      costUsd: number | null
      carrierLabel: string | null
      conversationId: string | null
      messageSent: boolean
    }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured (missing SHIPENGINE_API_KEY).", status: 503 }
  }

  const { data: profile, error: profileErr } = await params.supabase
    .from("profiles")
    .select("id")
    .eq("id", params.userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[purchaseAdminUserShippingLabel] profile:", profileErr)
    return { ok: false, error: "Could not load user", status: 500 }
  }
  if (!profile?.id) {
    return { ok: false, error: "User not found", status: 404 }
  }

  const parcelCheck = validateLabelParcelEntry({
    lengthIn: params.parcel.length_in,
    widthIn: params.parcel.width_in,
    heightIn: params.parcel.height_in,
    weightLb: params.parcel.weight_lb,
  })
  if (!parcelCheck.ok) {
    return { ok: false, error: parcelCheck.error, status: 422 }
  }

  const purchased = await purchaseLabelWithRateId(params.rateId)
  if (!purchased.ok) {
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  const trackingNumber = purchased.result.trackingNumber.trim()
  const trackingCarrier = purchased.result.trackingCarrier?.trim() || null

  const notified = await startStaffOutboundMarketplaceConversation({
    supabase: params.supabase,
    staffUserId: params.staffUserId,
    targetUserId: params.userId,
    initialMessage: buildPackageOnTheWayMessage({
      trackingNumber,
      trackingCarrier,
    }),
  })

  const conversationId = notified.ok ? notified.conversationId : null
  if (!notified.ok) {
    console.error("[purchaseAdminUserShippingLabel] notify:", notified.error)
  }

  const inserted = await insertAdminUserShippingLabel(params.supabase, {
    recipientUserId: params.userId,
    createdBy: params.staffUserId,
    conversationId,
    labelPdfUrl: purchased.result.labelUrl,
    trackingNumber,
    trackingCarrier,
    shipengineRateId: params.rateId,
    labelCostUsd: purchased.result.costAmount,
    labelCostCurrency: purchased.result.costCurrency,
    parcelLengthIn: params.parcel.length_in,
    parcelWidthIn: params.parcel.width_in,
    parcelHeightIn: params.parcel.height_in,
    parcelWeightLb: params.parcel.weight_lb,
    shipTo: params.shipTo,
  })
  if (inserted.error) {
    console.error("[purchaseAdminUserShippingLabel] persist:", inserted.error)
  }

  return {
    ok: true,
    labelUrl: purchased.result.labelUrl,
    trackingNumber,
    trackingCarrier,
    costUsd: purchased.result.costAmount,
    carrierLabel: trackingCarrier,
    conversationId,
    messageSent: notified.ok,
  }
}
