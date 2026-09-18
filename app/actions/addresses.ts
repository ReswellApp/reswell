"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import { profileAddressInputSchema, profileAddressPatchSchema } from "@/lib/address-input"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  buyerAddressInsertFromCarrierFields,
  normalizeBuyerAddressForCarriers,
} from "@/lib/services/checkoutBuyerAddress"

export async function getProfileAddresses(): Promise<{
  addresses: ProfileAddressRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { addresses: [], error: "Unauthorized" }
  }

  const { addresses, error } = await fetchProfileAddresses(supabase, user.id)

  return { addresses, error: error ?? null }
}

export async function createProfileAddress(
  raw: unknown,
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { address: null, error: "Unauthorized" }
  }

  const parsed = profileAddressInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { address: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const input = parsed.data
  const isDefault = input.is_default === true

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle()

  const identity = await resolveAddressShippingIdentity(supabase, user.id, {
    full_name: input.full_name,
    phone: input.phone,
    display_name: profileRow?.display_name,
  })

  if (!identity.full_name.trim()) {
    return {
      address: null,
      error: "Add your first and last name under Addresses → Personal information before saving an address.",
    }
  }

  if (!identity.phone?.trim()) {
    return {
      address: null,
      error: "Add a phone number in checkout contact details before saving an address.",
    }
  }

  const normalized = await normalizeBuyerAddressForCarriers({
    full_name: identity.full_name,
    phone: identity.phone,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    state: input.state ?? null,
    postal_code: input.postal_code,
    country: input.country,
  })
  if (!normalized.ok && normalized.fatal) {
    return { address: null, error: normalized.error }
  }

  const carrierFields = buyerAddressInsertFromCarrierFields(
    identity,
    {
      full_name: identity.full_name,
      phone: identity.phone,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state ?? null,
      postal_code: input.postal_code,
      country: input.country,
    },
    normalized.ok ? normalized.fields : null,
  )

  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id)
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      profile_id: user.id,
      full_name: carrierFields.full_name,
      phone: carrierFields.phone,
      line1: carrierFields.line1,
      line2: carrierFields.line2,
      city: carrierFields.city,
      state: carrierFields.state,
      postal_code: carrierFields.postal_code,
      country: carrierFields.country,
      label: input.label?.trim() || null,
      is_default: isDefault,
      residential: carrierFields.residential ?? "unknown",
      address_validated_at: carrierFields.address_validated_at ?? null,
    })
    .select()
    .single()

  if (error) {
    return { address: null, error: error.message }
  }

  return { address: data as ProfileAddressRow, error: null }
}

export async function updateProfileAddress(
  addressId: string,
  raw: unknown,
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
  const id = addressId?.trim()
  if (!id) {
    return { address: null, error: "Missing address id" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { address: null, error: "Unauthorized" }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle()

  if (fetchError || !existing) {
    return { address: null, error: "Address not found" }
  }

  const parsed = profileAddressPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return { address: null, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const input = parsed.data

  if (input.is_default === true) {
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id).neq("id", id)
  }

  const streetChanged =
    input.line1 !== undefined ||
    input.line2 !== undefined ||
    input.city !== undefined ||
    input.state !== undefined ||
    input.postal_code !== undefined ||
    input.country !== undefined

  const update: Record<string, unknown> = {}
  if (input.line1 !== undefined) update.line1 = input.line1
  if (input.line2 !== undefined) update.line2 = input.line2?.trim() || null
  if (input.city !== undefined) update.city = input.city
  if (input.state !== undefined) update.state = input.state?.trim() || null
  if (input.postal_code !== undefined) update.postal_code = input.postal_code
  if (input.country !== undefined) update.country = input.country
  if (input.label !== undefined) update.label = input.label?.trim() || null
  if (input.is_default !== undefined) update.is_default = input.is_default

  if (input.full_name !== undefined || input.phone !== undefined) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()

    const identity = await resolveAddressShippingIdentity(supabase, user.id, {
      full_name: input.full_name,
      phone: input.phone,
      display_name: profileRow?.display_name,
    })
    if (input.full_name !== undefined) update.full_name = identity.full_name
    if (input.phone !== undefined) update.phone = identity.phone
  } else {
    // Refresh cached name/phone from profile when shipping fields change.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()

    const identity = await resolveAddressShippingIdentity(supabase, user.id, {
      display_name: profileRow?.display_name,
    })
    update.full_name = identity.full_name
    update.phone = identity.phone
  }

  if (streetChanged) {
    const existingRow = existing as ProfileAddressRow
    const merged = {
      full_name: String(update.full_name ?? existingRow.full_name),
      phone:
        (typeof update.phone === "string" ? update.phone : existingRow.phone) ?? null,
      line1: String(update.line1 ?? existingRow.line1),
      line2:
        (update.line2 === undefined ? existingRow.line2 : (update.line2 as string | null)) ??
        null,
      city: String(update.city ?? existingRow.city),
      state:
        (update.state === undefined ? existingRow.state : (update.state as string | null)) ??
        null,
      postal_code: String(update.postal_code ?? existingRow.postal_code),
      country: String(update.country ?? existingRow.country),
    }
    const normalized = await normalizeBuyerAddressForCarriers(merged)
    if (!normalized.ok && normalized.fatal) {
      return { address: null, error: normalized.error }
    }
    if (normalized.ok) {
      update.line1 = normalized.fields.line1
      update.line2 = normalized.fields.line2
      update.city = normalized.fields.city
      update.state = normalized.fields.state
      update.postal_code = normalized.fields.postal_code
      update.country = normalized.fields.country
      update.residential = normalized.fields.residential
      update.address_validated_at = new Date().toISOString()
    } else {
      update.residential = "unknown"
      update.address_validated_at = null
    }
  }

  const { data, error } = await supabase
    .from("addresses")
    .update(update)
    .eq("id", id)
    .eq("profile_id", user.id)
    .select()
    .single()

  if (error) {
    return { address: null, error: error.message }
  }

  return { address: data as ProfileAddressRow, error: null }
}

export async function deleteProfileAddress(addressId: string): Promise<{ ok: boolean; error: string | null }> {
  const id = addressId?.trim()
  if (!id) {
    return { ok: false, error: "Missing address id" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("profile_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, error: null }
}
