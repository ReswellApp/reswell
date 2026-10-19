"use server"

import { z } from "zod"

import { shippingAddressFormSchema } from "@/lib/address-input"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import { fetchProfileAddresses, preferredProfileAddress } from "@/lib/db/profile-addresses"
import { updateProfileDefaultListingLocality } from "@/lib/db/profileDefaultListingLocality"
import { getProfilePersonalInfo, updateProfilePersonalInfo } from "@/lib/db/profilePersonalInfo"
import { sellerHasSoldSurfboardsOrFins } from "@/lib/db/sellerSoldListings"
import { fetchSellerShippingLocality } from "@/lib/db/sellerShippingLocality"
import { googleForwardGeocode } from "@/lib/maps/google-geocoding-server"
import {
  listingLocalityFromAddress,
  type ListingLocalityFromAddress,
} from "@/lib/sell-flow/listing-locality-from-address"
import {
  decideSignInShipFromPrompt,
  type SignInShipFromPromptResult,
} from "@/lib/services/signInShipFromPrompt"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient } from "@/lib/supabase/server"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

const saveSellerShipFromSchema = shippingAddressFormSchema.extend({
  full_name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  /** Update this saved row instead of inserting another address. */
  address_id: z.string().uuid().optional(),
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
  const managed = await resolveManagedSeller("profile.manage")

  if (!managed.ok) {
    return {
      hasShipFrom: false,
      needsFullName: true,
      needsPhone: true,
      signedIn: managed.status !== 401,
      locality: null,
    }
  }
  const profileId = managed.seller.sellerId

  const [addressesResult, personal] = await Promise.all([
    fetchProfileAddresses(supabase, profileId),
    getProfilePersonalInfo(supabase, profileId),
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

/** Signed-in seller prompt. Buyers and sellers with a complete ship-from get nothing to show. */
export async function getSignInShipFromPrompt(): Promise<SignInShipFromPromptResult> {
  const supabase = await createClient()
  const managed = await resolveManagedSeller("profile.manage")

  if (!managed.ok) return { shouldPrompt: false }
  const profileId = managed.seller.sellerId

  const [addressesResult, personal, locality, hasSold] = await Promise.all([
    fetchProfileAddresses(supabase, profileId),
    getProfilePersonalInfo(supabase, profileId),
    fetchSellerShippingLocality(supabase, profileId),
    sellerHasSoldSurfboardsOrFins(supabase, profileId),
  ])

  if (addressesResult.error) return { shouldPrompt: false }

  return decideSignInShipFromPrompt({
    offersShipping: locality.offersShipping || hasSold,
    addresses: addressesResult.addresses,
    personal,
    listingCity: locality.city,
    listingState: locality.state,
  })
}

export async function saveSellerShipFromAddress(
  raw: unknown,
): Promise<{
  locality: ListingLocalityFromAddress | null
  error: string | null
}> {
  const supabase = await createClient()
  const managed = await resolveManagedSeller("profile.manage")

  if (!managed.ok) {
    return { locality: null, error: managed.error }
  }
  const profileId = managed.seller.sellerId

  const parsed = saveSellerShipFromSchema.safeParse(raw)
  if (!parsed.success) {
    return { locality: null, error: parsed.error.issues[0]?.message ?? "Invalid address" }
  }

  const input = parsed.data
  const personal = await getProfilePersonalInfo(supabase, profileId)

  if (!hasLegalName(personal)) {
    if (!input.full_name?.trim()) {
      return { locality: null, error: "Enter the name to print on shipping labels." }
    }
    const names = splitPersonName(input.full_name)
    const nameUpdate = await updateProfilePersonalInfo(supabase, profileId, names)
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
    const phoneUpdate = await updateProfilePersonalInfo(supabase, profileId, { phone })
    if (!phoneUpdate.ok) {
      return { locality: null, error: phoneUpdate.error }
    }
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle()

  const identity = await resolveAddressShippingIdentity(supabase, profileId, {
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

  const row = {
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
  }

  if (input.address_id) {
    const { data: existing, error: existingError } = await supabase
      .from("addresses")
      .select("id")
      .eq("id", input.address_id)
      .eq("profile_id", profileId)
      .maybeSingle()
    if (existingError || !existing) {
      return { locality: null, error: "Address not found." }
    }
  }

  await supabase.from("addresses").update({ is_default: false }).eq("profile_id", profileId)

  const { error } = input.address_id
    ? await supabase.from("addresses").update(row).eq("id", input.address_id).eq("profile_id", profileId)
    : await supabase.from("addresses").insert({ profile_id: profileId, ...row })

  if (error) {
    return { locality: null, error: error.message }
  }

  const locality = await localityForPreferredAddress(input.city, input.state ?? null)

  if (locality) {
    await updateProfileDefaultListingLocality(supabase, profileId, {
      city: locality.city,
      state: locality.state || null,
      lat: locality.lat,
      lng: locality.lng,
      display: locality.displayName,
    })
  }

  return { locality, error: null }
}
