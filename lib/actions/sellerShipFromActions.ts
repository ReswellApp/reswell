"use server"

import { z } from "zod"

import { shippingAddressFormSchema } from "@/lib/address-input"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import { fetchProfileAddresses, preferredProfileAddress } from "@/lib/db/profile-addresses"
import { updateProfileDefaultListingLocality } from "@/lib/db/profileDefaultListingLocality"
import { getProfilePersonalInfo, updateProfilePersonalInfo } from "@/lib/db/profilePersonalInfo"
import { googleForwardGeocode } from "@/lib/maps/google-geocoding-server"
import {
  listingLocalityFromAddress,
  type ListingLocalityFromAddress,
} from "@/lib/sell-flow/listing-locality-from-address"
import { createClient } from "@/lib/supabase/server"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

const saveSellerShipFromSchema = shippingAddressFormSchema.extend({
  full_name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).optional(),
})

export type SellerShipFromSetup = {
  hasShipFrom: boolean
  needsFullName: boolean
  needsPhone: boolean
  signedIn: boolean
  /** City/state (+ optional city-centroid pin). Never includes street. */
  locality: ListingLocalityFromAddress | null
}

function splitPersonName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: "", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0]!, last_name: parts[0]! }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") }
}

function hasLegalName(personal: { first_name: string | null; last_name: string | null } | null): boolean {
  return Boolean(personal?.first_name?.trim() && personal?.last_name?.trim())
}

async function geocodeCityStateCentroid(
  city: string,
  state: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = [city.trim(), state.trim(), "USA"].filter(Boolean).join(", ")
  if (q.length < 3) return null
  const hit = await googleForwardGeocode(q)
  if (!hit) return null
  return { lat: hit.lat, lng: hit.lng }
}

async function localityForPreferredAddress(
  city: string,
  state: string | null,
): Promise<ListingLocalityFromAddress | null> {
  const base = listingLocalityFromAddress({ city, state })
  if (!base) return null
  const pin = await geocodeCityStateCentroid(city, state ?? "")
  return {
    ...base,
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
  }
}

export async function getSellerShipFromSetup(): Promise<SellerShipFromSetup> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      hasShipFrom: false,
      needsFullName: true,
      needsPhone: true,
      signedIn: false,
      locality: null,
    }
  }

  const [addressesResult, personal] = await Promise.all([
    fetchProfileAddresses(supabase, user.id),
    getProfilePersonalInfo(supabase, user.id),
  ])

  const preferred = preferredProfileAddress(addressesResult.addresses)
  let locality: ListingLocalityFromAddress | null = null

  if (preferred) {
    // City-centroid pin only — never the street coordinate from the saved address.
    locality = await localityForPreferredAddress(preferred.city, preferred.state)
  }

  return {
    hasShipFrom: Boolean(preferred),
    needsFullName: !hasLegalName(personal),
    needsPhone: !personal?.phone?.trim(),
    signedIn: true,
    locality,
  }
}

export async function saveSellerShipFromAddress(
  raw: unknown,
): Promise<{
  locality: ListingLocalityFromAddress | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { locality: null, error: "Sign in to save your ship-from address." }
  }

  const parsed = saveSellerShipFromSchema.safeParse(raw)
  if (!parsed.success) {
    return { locality: null, error: parsed.error.issues[0]?.message ?? "Invalid address" }
  }

  const input = parsed.data
  const personal = await getProfilePersonalInfo(supabase, user.id)

  if (!hasLegalName(personal)) {
    if (!input.full_name?.trim()) {
      return { locality: null, error: "Enter the name to print on shipping labels." }
    }
    const names = splitPersonName(input.full_name)
    const nameUpdate = await updateProfilePersonalInfo(supabase, user.id, names)
    if (!nameUpdate.ok) {
      return { locality: null, error: nameUpdate.error }
    }
  }

  if (!personal?.phone?.trim()) {
    const phone = input.phone?.trim() ?? ""
    if (!phone) {
      return { locality: null, error: "Enter a phone number for the carrier." }
    }
    if (!toE164UsPhone(phone)) {
      return { locality: null, error: "Enter a valid US phone number." }
    }
    const phoneUpdate = await updateProfilePersonalInfo(supabase, user.id, { phone })
    if (!phoneUpdate.ok) {
      return { locality: null, error: phoneUpdate.error }
    }
  }

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
    return { locality: null, error: "Enter the name to print on shipping labels." }
  }
  if (!identity.phone?.trim()) {
    return { locality: null, error: "Enter a phone number for the carrier." }
  }

  await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id)

  const { error } = await supabase.from("addresses").insert({
    profile_id: user.id,
    full_name: identity.full_name,
    phone: identity.phone,
    line1: input.line1,
    line2: input.line2?.trim() || null,
    city: input.city,
    state: input.state?.trim() || null,
    postal_code: input.postal_code,
    country: input.country || "US",
    label: input.label?.trim() || "Ship from",
    is_default: true,
  })

  if (error) {
    return { locality: null, error: error.message }
  }

  const locality = await localityForPreferredAddress(input.city, input.state ?? null)

  if (locality) {
    await updateProfileDefaultListingLocality(supabase, user.id, {
      city: locality.city,
      state: locality.state || null,
      lat: locality.lat,
      lng: locality.lng,
      display: locality.displayName,
    })
  }

  return { locality, error: null }
}
