import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { listingDimensionsColumnTrim } from "@/lib/listing-dimensions-storage"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"
import { notifyFollowersNewListingKlaviyo } from "@/lib/services/notifyFollowersNewListingKlaviyo"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { mirrorExternalListingImagesToStorage } from "@/lib/services/importListingImages"
import { slugify } from "@/lib/slugify"
import type { z } from "zod"
import type { fbMarketplacePublishBodySchema } from "@/lib/validations/fb-marketplace-import"

type PublishInput = z.infer<typeof fbMarketplacePublishBodySchema>

export type PublishImportListingResult =
  | { ok: true; listingId: string; slug: string }
  | { ok: false; status: number; error: string }

async function generateUniqueSlug(
  supabase: SupabaseClient,
  title: string,
): Promise<string> {
  const baseSlug = slugify(title)
  let slug = baseSlug
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", baseSlug)
  if (!count) return slug

  for (let i = 2; i < 100; i++) {
    const candidate = `${baseSlug}-${i}`
    const { count: c } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate)
    if (!c) {
      slug = candidate
      break
    }
  }
  return slug
}

export async function publishImportListing(opts: {
  supabase: SupabaseClient
  serviceSupabase: SupabaseClient
  userId: string
  userEmail: string | null
  input: PublishInput
}): Promise<PublishImportListingResult> {
  const { supabase, serviceSupabase, userId, userEmail, input } = opts

  const mirrored = await mirrorExternalListingImagesToStorage({
    supabase: serviceSupabase,
    userId,
    imageUrls: input.importedImageUrls,
  })

  const images = [...mirrored, ...input.uploadedImages.map((img) => ({
    url: img.url,
    thumbnail_url: img.thumbnail_url?.trim() || img.url,
  }))]

  if (images.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Add at least one photo before publishing.",
    }
  }

  const slug = await generateUniqueSlug(supabase, input.title)
  const dimensions = listingDimensionsColumnTrim(input.dimensions) ?? null

  const listingInsertRow = {
    user_id: userId,
    title: input.title,
    slug,
    description: input.description || null,
    price: input.price,
    condition: input.condition,
    section: "surfboards" as const,
    category_id: boardCategoryMap.other,
    board_type: "other",
    shipping_available: false,
    local_pickup: true,
    shipping_price: null,
    board_shipping_cost_mode: null,
    city: input.city,
    state: input.state,
    brand: input.brand.trim() || null,
    model: input.model.trim() || null,
    dimensions,
    status: "active" as const,
  }

  let { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert(listingInsertRow)
    .select("id, slug")
    .single()

  if (listingError && isListingDimensionDisplaySchemaCacheError(listingError)) {
    const retry = await supabase
      .from("listings")
      .insert(withoutListingDimensionDisplayDbFields(listingInsertRow as Record<string, unknown>))
      .select("id, slug")
      .single()
    listing = retry.data
    listingError = retry.error
  }

  if (listingError || !listing) {
    console.error("[publishImportListing] insert:", listingError)
    return { ok: false, status: 500, error: "Failed to create listing." }
  }

  const imageInserts = images.map((entry, index) => ({
    listing_id: listing.id,
    url: entry.url,
    thumbnail_url: entry.thumbnail_url,
    is_primary: index === 0,
    sort_order: index,
  }))

  const { error: imagesError } = await supabase.from("listing_images").insert(imageInserts)
  if (imagesError) {
    console.error("[publishImportListing] listing_images:", imagesError)
    return { ok: false, status: 500, error: "Listing was created but photos failed to save." }
  }

  try {
    await syncListingToIndex(supabase, listing.id)
  } catch {
    // ES optional
  }

  void syncListingToGoogleMerchantBestEffort(supabase, listing.id)
  void trackKlaviyoListingCreated({
    sellerUserId: userId,
    sellerEmail: userEmail,
    listingId: listing.id,
    title: input.title,
    price: input.price,
    photoUrl: images[0]?.thumbnail_url ?? images[0]?.url ?? null,
    localPickup: true,
    shippingAvailable: false,
  })
  void trackFirstTimeSellerForListingIfNeeded(supabase, {
    listingId: listing.id,
    sellerUserId: userId,
    sellerEmail: userEmail,
  })
  void notifyBoardSavedSearchMatchesForListing(listing.id)
  void notifyFollowersNewListingKlaviyo(listing.id)

  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(supabase, userId)
  revalidateNavSearchSuggest()

  return { ok: true, listingId: listing.id, slug: listing.slug ?? slug }
}
