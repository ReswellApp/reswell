import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressFieldsFromOrder, ProfileAddressRow } from "@/lib/profile-address"
import { normalizeCountryCodeForShipping } from "@/lib/shipping/normalize-country-code"
import {
  checkoutPoBoxErrorForSections,
  isBuyerAddressValidationFresh,
  localBuyerAddressFieldsFromInput,
  matchedAddressToBuyerFields,
  type BuyerAddressCarrierFields,
} from "@/lib/shipping/buyer-address-validation"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import { validateShipEngineAddress } from "@/lib/shipengine/validate-address"

export type NormalizeBuyerAddressForCarriersResult =
  | { ok: true; fields: BuyerAddressCarrierFields }
  | { ok: false; fatal: true; error: string }
  | { ok: false; fatal: false; error: string }

export async function normalizeBuyerAddressForCarriers(
  input: Pick<
    ProfileAddressFieldsFromOrder,
    "full_name" | "phone" | "line1" | "line2" | "city" | "state" | "postal_code" | "country"
  >,
): Promise<NormalizeBuyerAddressForCarriersResult> {
  const country = normalizeCountryCodeForShipping(input.country)
  if (country !== "US") {
    return {
      ok: false,
      fatal: true,
      error: "Only US shipping addresses are supported.",
    }
  }

  const line1 = input.line1.trim()
  const city = input.city.trim()
  const postal_code = input.postal_code.trim()
  if (!line1 || !city || !postal_code) {
    return {
      ok: false,
      fatal: true,
      error: "Street, city, and ZIP are required.",
    }
  }

  const result = await validateShipEngineAddress({
    name: input.full_name,
    phone: input.phone,
    address_line1: line1,
    address_line2: input.line2,
    city_locality: city,
    state_province: input.state ?? "",
    postal_code,
    country_code: country,
  })

  if (result.ok && result.validation.matched) {
    return { ok: true, fields: matchedAddressToBuyerFields(result.validation.matched) }
  }

  const local = localBuyerAddressFieldsFromInput({
    line1,
    line2: input.line2,
    city,
    state: input.state,
    postal_code,
    country,
  })
  if (!local.ok) {
    return { ok: false, fatal: true, error: local.error }
  }

  if (!result.ok) {
    console.info("[checkoutBuyerAddress] carrier lookup unavailable; using buyer-entered address", {
      unavailable: result.unavailable,
    })
  } else {
    console.info("[checkoutBuyerAddress] carrier did not confirm address; using buyer-entered address", {
      status: result.validation.status,
    })
  }

  return { ok: true, fields: local.fields }
}

export async function persistBuyerAddressCarrierFields(
  supabase: SupabaseClient,
  address: ProfileAddressRow,
  fields: BuyerAddressCarrierFields,
): Promise<ProfileAddressRow> {
  const patch = {
    line1: fields.line1,
    line2: fields.line2,
    city: fields.city,
    state: fields.state,
    postal_code: fields.postal_code,
    country: fields.country,
    residential: fields.residential,
    address_validated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("addresses")
    .update(patch)
    .eq("id", address.id)
    .eq("profile_id", address.profile_id)
    .select()
    .maybeSingle()

  if (error || !data) {
    console.error("[checkoutBuyerAddress] persist validation failed", error)
    return {
      ...address,
      ...patch,
    }
  }

  return data as ProfileAddressRow
}

export async function refreshBuyerAddressCarrierValidation(
  supabase: SupabaseClient,
  address: ProfileAddressRow,
): Promise<{ ok: true; address: ProfileAddressRow } | { ok: false; error: string }> {
  if (isBuyerAddressValidationFresh(address.address_validated_at)) {
    return { ok: true, address }
  }

  const normalized = await normalizeBuyerAddressForCarriers(address)
  if (normalized.ok) {
    return {
      ok: true,
      address: await persistBuyerAddressCarrierFields(supabase, address, normalized.fields),
    }
  }

  if (!normalized.fatal && address.address_validated_at) {
    return { ok: true, address }
  }

  return { ok: false, error: normalized.error }
}

export async function ensureCheckoutBuyerShippingAddress(input: {
  supabase: SupabaseClient
  address: ProfileAddressRow
  listingSections: Array<string | null | undefined>
}): Promise<{ ok: true; address: ProfileAddressRow } | { ok: false; error: string }> {
  const poBoxBefore = checkoutPoBoxErrorForSections(input.address, input.listingSections)
  if (poBoxBefore) {
    return { ok: false, error: poBoxBefore }
  }

  const refreshed = await refreshBuyerAddressCarrierValidation(input.supabase, input.address)
  if (!refreshed.ok) {
    return refreshed
  }

  const poBoxAfter = checkoutPoBoxErrorForSections(refreshed.address, input.listingSections)
  if (poBoxAfter) {
    return { ok: false, error: poBoxAfter }
  }

  return refreshed
}

export function buyerAddressInsertFromCarrierFields(
  identity: { full_name: string; phone: string | null },
  original: ProfileAddressFieldsFromOrder,
  carrier: BuyerAddressCarrierFields | null,
): ProfileAddressFieldsFromOrder {
  const country = normalizeCountryCodeForShipping(carrier?.country ?? original.country)
  return {
    full_name: identity.full_name,
    phone: identity.phone,
    line1: carrier?.line1 ?? original.line1,
    line2: carrier?.line2 ?? original.line2,
    city: carrier?.city ?? original.city,
    state:
      carrier?.state ??
      (original.state
        ? normalizeUsStateProvinceForShipping(country, original.state) || original.state
        : null),
    postal_code: carrier?.postal_code ?? original.postal_code,
    country,
    residential: carrier?.residential ?? "unknown",
    address_validated_at: carrier ? new Date().toISOString() : null,
  }
}
