"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateListingDetailCache } from "@/lib/listing-detail-cache"

/**
 * Call after a user or admin updates profile fields that appear on `/l/[slug]`
 * (e.g. display name, avatar, location, shop verification).
 */
export async function revalidateListingDetailAfterProfileUpdate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const }
  }
  revalidateListingDetailCache()
  return { ok: true as const }
}

/** Call after a seller creates or updates a listing so `/l/[slug]` reflects new fulfillment flags. */
export async function revalidateListingDetailAfterListingMutation() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const }
  }
  revalidateListingDetailCache()
  return { ok: true as const }
}
