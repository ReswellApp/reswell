import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchProfileAddresses, preferredProfileAddress } from "@/lib/db/profile-addresses"
import { getProfilePersonalInfo } from "@/lib/db/profilePersonalInfo"
import { sellerHasSoldSurfboardsOrFins } from "@/lib/db/sellerSoldListings"

export type SellHubShipFromPrompt =
  | { shouldPrompt: true; needsFullName: boolean; needsPhone: boolean }
  | { shouldPrompt: false }

function hasLegalName(personal: { first_name: string | null; last_name: string | null } | null): boolean {
  return Boolean(personal?.first_name?.trim() && personal?.last_name?.trim())
}

/**
 * Hub `/sell` prompt for returning board/fin sellers who still have no
 * saved ship-from address. First-time sellers are not prompted here —
 * the listing flow asks when they offer shipping.
 */
export async function getSellHubShipFromPrompt(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<SellHubShipFromPrompt> {
  const uid = userId?.trim() ?? ""
  if (!uid) return { shouldPrompt: false }

  const [addressesResult, personal] = await Promise.all([
    fetchProfileAddresses(supabase, uid),
    getProfilePersonalInfo(supabase, uid),
  ])

  if (addressesResult.error) {
    return { shouldPrompt: false }
  }

  if (preferredProfileAddress(addressesResult.addresses)) {
    return { shouldPrompt: false }
  }

  const hasSold = await sellerHasSoldSurfboardsOrFins(supabase, uid)
  if (!hasSold) return { shouldPrompt: false }

  return {
    shouldPrompt: true,
    needsFullName: !hasLegalName(personal),
    needsPhone: !personal?.phone?.trim(),
  }
}
