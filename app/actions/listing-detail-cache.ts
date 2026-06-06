"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingPublicDetailCatalog } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateNavSuggestedSurfboards } from "@/lib/cache/revalidate-nav-suggested-surfboards"
import {
  revalidateSellerProfileAndDirectoryCatalog,
  revalidateSellersDirectoryCatalog,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { listingDetailHref } from "@/lib/listing-href"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const listingMutationRevalidateSchema = z.object({
  listingId: z.string().uuid(),
  slug: z.string().nullable().optional(),
})

/**
 * `/l/[listing]` is cached by the App Router; invalidate the canonical URL (and the `/l/{uuid}`
 * alias when a slug exists) so the next visit reflects fresh fulfillment and listing fields.
 */
function revalidateListingDetailPaths(listingId: string, slug?: string | null) {
  const primary = listingDetailHref({
    id: listingId,
    slug: slug ?? undefined,
    section: "surfboards",
  })
  revalidatePath(primary, "page")

  const trimmed = typeof slug === "string" ? slug.trim() : ""
  if (trimmed !== "") {
    revalidatePath(`/l/${listingId}`, "page")
  }

  revalidateListingPublicDetailCatalog()
}

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

  revalidateListingDetailPaths(listingId, slug ?? null)
  revalidateBoardsBrowseCatalog()
  revalidateNavSuggestedSurfboards()
  revalidateSellersDirectoryCatalog()

  try {
    const serviceSupabase = createServiceRoleClient()
    await syncListingToGoogleMerchantBestEffort(serviceSupabase, listingId)
  } catch {
    // Service role optional in local dev; GMC sync also runs via DB webhook when configured.
  }

  return { ok: true }
}
