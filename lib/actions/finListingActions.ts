"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import { createFinListingSchema, updateFinListingSchema } from "@/lib/validations/fin-listing"
import { createFinListing, updateFinListing } from "@/lib/services/finListing"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { getFinCatalogSearchSellCached } from "@/lib/cache/fin-catalog-search-sell"
import { searchFinBrandsCatalogSuggestWithClient } from "@/lib/services/finCatalogSearch"
import type { BrandCatalogSuggestResponse } from "@/lib/services/brandDirectorySearch"
import type { FinCatalogSearchResult } from "@/lib/types/fin-catalog-search"

const finCatalogSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter a search term").max(200),
})

export type CreateFinListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateFinListingActionResult =
  | { success: true; slug: string }
  | { error: string }

export type SearchFinCatalogForSellActionResult =
  | { ok: true; data: FinCatalogSearchResult }
  | { ok: false; error: string }

/** Brand directory typeahead for the `/sell/fins` form (fin-tagged brands only). */
export async function searchFinBrandsCatalogSuggest(
  qRaw: string,
): Promise<BrandCatalogSuggestResponse> {
  const supabase = await createClient()
  return searchFinBrandsCatalogSuggestWithClient(supabase, qRaw)
}

/** Catalog search for the `/sell/fins` entry step (fin-tagged brands only). */
export async function searchFinCatalogForSellAction(
  qRaw: string,
): Promise<SearchFinCatalogForSellActionResult> {
  const parsed = finCatalogSearchQuerySchema.safeParse({ q: qRaw })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? "Enter a search term." }
  }

  try {
    const data = await getFinCatalogSearchSellCached(parsed.data.q)
    return { ok: true, data }
  } catch (error) {
    console.error("searchFinCatalogForSellAction:", error instanceof Error ? error.message : error)
    return { ok: false, error: "Could not search the fin catalog. Please try again." }
  }
}

/**
 * Creates a fin listing (a single listings row with section='fins' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createFinListingAction(
  raw: unknown,
): Promise<CreateFinListingActionResult> {
  const parsed = createFinListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a fin." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createFinListing(supabase, user.id, parsed.data)
    void syncListingToGoogleMerchantBestEffort(supabase, result.listingId)
    void trackFirstTimeSellerForListingIfNeeded(supabase, {
      listingId: result.listingId,
      sellerUserId: user.id,
      sellerEmail: user.email ?? null,
    })
    revalidatePath("/fins")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createFinListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your fin listing. Please try again." }
  }
}

/**
 * Updates an existing fin listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateFinListingAction(
  raw: unknown,
): Promise<UpdateFinListingActionResult> {
  const parsed = updateFinListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to edit this listing." }
  }

  try {
    const result = await updateFinListing(supabase, parsed.data.listingId, user.id, parsed.data)
    void syncListingToGoogleMerchantBestEffort(supabase, parsed.data.listingId)
    revalidatePath("/fins")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateFinListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error ? error.message : "We couldn't save your fin listing. Please try again.",
    }
  }
}
