"use server"

import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import {
  syncListingImages,
  type SyncedListingImage,
} from "@/lib/services/sync-listing-images"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listingImageSyncSchema } from "@/lib/validations/listing-image-sync"

export type SyncListingImagesActionResult =
  | { images: SyncedListingImage[] }
  | { error: string }

/**
 * The only client entry for `listing_images`. Upload stays in the browser.
 * Rows are reconciled here, same function publish uses, so a draft save and
 * go-live cannot each insert the gallery.
 */
export async function syncListingImagesAction(
  raw: unknown,
): Promise<SyncListingImagesActionResult> {
  const parsed = listingImageSyncSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid photos." }

  const managed = await resolveManagedSeller("listings.write")
  if (!managed.ok) return { error: managed.error }

  let writer
  if (managed.seller.actingAsShop) {
    try {
      writer = createServiceRoleClient()
    } catch {
      return { error: "Could not save photos right now." }
    }
  } else {
    writer = await createClient()
  }

  const { data: listing, error: listingError } = await writer
    .from("listings")
    .select("user_id, status, inventory_source")
    .eq("id", parsed.data.listingId)
    .maybeSingle()

  if (listingError || !listing) return { error: "Listing not found." }
  if (listing.user_id !== managed.seller.sellerId) {
    return { error: "You can only edit your own listings." }
  }
  if (listing.status === "sold") return { error: "Sold listings cannot be edited." }
  if (listing.inventory_source === "shopify") {
    return { error: "Shopify photos are managed by the store." }
  }

  try {
    const images = await syncListingImages(
      writer,
      parsed.data.listingId,
      parsed.data.removedImageIds,
      parsed.data.images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl ?? null,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
      })),
    )
    return { images }
  } catch (error) {
    console.error(
      "[syncListingImagesAction]",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not save listing photos." }
  }
}
