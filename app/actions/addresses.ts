"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import { profileAddressInputSchema, profileAddressPatchSchema } from "@/lib/address-input"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import type { ProfileAddressRow } from "@/lib/profile-address"

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

  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id)
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      profile_id: user.id,
      full_name: identity.full_name,
      phone: identity.phone,
      line1: input.line1,
      line2: input.line2?.trim() || null,
      city: input.city,
      state: input.state?.trim() || null,
      postal_code: input.postal_code,
      country: input.country,
      label: input.label?.trim() || null,
      is_default: isDefault,
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
    .select("id, profile_id")
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
