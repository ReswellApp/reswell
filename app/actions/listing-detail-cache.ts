"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateNavSuggestedSurfboards } from "@/lib/cache/revalidate-nav-suggested-surfboards"
import {
  revalidateSellerProfileAndDirectoryCatalog,
  revalidateSellersDirectoryCatalog,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const listingMutationRevalidateSchema = z.object({
  listingId: z.string().uuid(),
  slug: z.string().nullable().optional(),
})

const profileUpdateRevalidateSchema = z.object({
  profileId: z.string().uuid().optional(),
})

/**
 * Call after a user or admin updates profile fields shown on seller surfaces
 * (display name, avatar, location, shop verification, banner, etc.).
 */
export async function revalidateListingDetailAfterProfileUpdate(rawInput?: unknown) {
  const parsed = profileUpdateRevalidateSchema.safeParse(rawInput ?? {})
  if (!parsed.success) {
    return { ok: false as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const }
  }

  const profileId = parsed.data.profileId ?? user.id
  await revalidateSellerProfileAndDirectoryCatalog(supabase, profileId)
  return { ok: true as const }
}

/**
 * Call after a seller creates or updates a listing so `/l/[listing]` is not serving a stale RSC payload.
 */
export async function revalidateListingDetailAfterListingMutation(
  rawInput: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = listingMutationRevalidateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, error: "Invalid listing reference" }
  }
  const { listingId, slug } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const sellerUserId = user.id
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("seller_slug")
    .eq("id", sellerUserId)
    .maybeSingle()
  const sellerSlug =
    typeof sellerProfile?.seller_slug === "string" ? sellerProfile.seller_slug.trim() : ""

  after(() => {
    revalidateListingDetailPage(listingId, slug ?? null)
    revalidateBoardsBrowseCatalog()
    revalidateNavSuggestedSurfboards()
    if (sellerSlug) {
      revalidatePath(`/sellers/${sellerSlug}`, "page")
    }
    revalidateSellersDirectoryCatalog()
    try {
      const serviceSupabase = createServiceRoleClient()
      syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
    } catch {
      // Service role optional in local dev; GMC sync also runs via DB webhook when configured.
    }
  })

  return { ok: true }
}
