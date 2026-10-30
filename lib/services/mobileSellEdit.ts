import {
  mobileSellEditLoadSchema,
  mobileSellUpdateSchema,
  type MobileSellEditLoad,
  type MobileSellPublish,
  type MobileSellPublishResult,
  type MobileSellUpdate,
} from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import { expirePublicListingSurfacesAfterEdit } from "@/lib/cache/revalidate-listing-after-edit"
import { fetchOwnedListingForEdit } from "@/lib/db/listingEdit"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { ownedListingRowToMobileSellEdit } from "@/lib/services/mobileSellEditMap"
import { mobileSellListingFields } from "@/lib/services/mobileSellListingFields"
import { replaceListingImages } from "@/lib/services/mobileSellPublish"
import {
  assertMobileSellVideos,
  replaceListingVideos,
} from "@/lib/services/mobileSellVideos"
import { isOwnedListingStorageUrl } from "@/lib/services/ownedListingStorageUrl"
import { verifyListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"

const EDITABLE_STATUSES = new Set(["active", "pending_sale", "draft", "delinquent"])

function editImageAllowed(
  url: string,
  userId: string,
  existing: { ids: Set<string>; urls: Set<string> },
  imageId?: string,
): boolean {
  if (imageId && existing.ids.has(imageId)) return true
  if (existing.urls.has(url)) return true
  return isOwnedListingStorageUrl(url, userId)
}

export async function getMobileListingEditService(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<MobileApiResult<MobileSellEditLoad>> {
  const row = await fetchOwnedListingForEdit(supabase, listingId, userId)
  if (!row) return { ok: false, status: 404, error: "Listing not found" }
  const status = typeof row.status === "string" ? row.status : ""
  if (status === "sold") return { ok: false, status: 400, error: "Sold listings cannot be edited here" }
  if (!EDITABLE_STATUSES.has(status)) {
    return { ok: false, status: 400, error: "This listing cannot be edited" }
  }

  const mapped = ownedListingRowToMobileSellEdit(row)
  if (!mapped.ok) return { ok: false, status: 400, error: mapped.error }

  const payload = {
    ...mapped.draft,
    listing_id: mapped.listingId,
    status: mapped.status,
    slug: mapped.slug,
    location_label: mapped.locationLabel,
  }
  const parsed = mobileSellEditLoadSchema.safeParse(payload)
  if (!parsed.success) {
    console.error("[mobile-api] sell edit load shape failed", {
      listingId,
      timestamp: new Date().toISOString(),
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    })
    return { ok: false, status: 500, error: "Unable to load listing for edit" }
  }
  return { ok: true, data: parsed.data }
}

export async function updateMobileListingEditService(
  supabase: SupabaseClient,
  userId: string,
  input: MobileSellUpdate,
): Promise<MobileApiResult<MobileSellPublishResult>> {
  const parsed = mobileSellUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid listing update" }
  }

  const listingId = parsed.data.listing_id
  const existing = await supabase
    .from("listings")
    .select("id, user_id, status, slug")
    .eq("id", listingId)
    .maybeSingle()
  if (existing.error || !existing.data || existing.data.user_id !== userId) {
    return { ok: false, status: 404, error: "Listing not found" }
  }
  const status = String(existing.data.status ?? "")
  if (status === "sold") return { ok: false, status: 400, error: "Sold listings cannot be edited" }
  if (!EDITABLE_STATUSES.has(status)) {
    return { ok: false, status: 400, error: "This listing cannot be edited" }
  }

  const publishInput: MobileSellPublish = {
    ...parsed.data,
    images: parsed.data.images.map(({ url, thumbnail_url }) => ({ url, thumbnail_url })),
    draft_id: null,
  }
  const built = mobileSellListingFields(publishInput)
  if (!built.ok) return { ok: false, status: 400, error: built.error }

  if (parsed.data.images.length < 1) {
    return { ok: false, status: 400, error: "Add at least one photo" }
  }
  if (parsed.data.images.some((image) => !image.url || !image.thumbnail_url)) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }

  const existingImages = await supabase
    .from("listing_images")
    .select("id, url, thumbnail_url")
    .eq("listing_id", listingId)
  const knownImages = {
    ids: new Set((existingImages.data ?? []).map((row) => String(row.id))),
    urls: new Set(
      (existingImages.data ?? []).flatMap((row) =>
        [row.url, row.thumbnail_url].filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    ),
  }

  if (
    parsed.data.images.some(
      (image) =>
        !editImageAllowed(image.url, userId, knownImages, image.image_id) ||
        !editImageAllowed(image.thumbnail_url, userId, knownImages, image.image_id),
    )
  ) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  for (const image of parsed.data.images) {
    const ok = await verifyListingImageObjectsExist(image.url, image.thumbnail_url)
    if (!ok) return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  const videoError = await assertMobileSellVideos(parsed.data.videos, userId)
  if (videoError) return { ok: false, status: 400, error: videoError }

  const updated = await supabase
    .from("listings")
    .update({ ...built.fields })
    .eq("id", listingId)
    .eq("user_id", userId)
  if (updated.error) {
    return { ok: false, status: 400, error: "Couldn't save this listing" }
  }

  const imageError = await replaceListingImages(supabase, listingId, parsed.data.images)
  if (imageError) return { ok: false, status: 400, error: imageError }
  if (parsed.data.videos !== undefined) {
    const listingVideoError = await replaceListingVideos(supabase, listingId, parsed.data.videos)
    if (listingVideoError) return { ok: false, status: 400, error: listingVideoError }
  }

  const slug = (existing.data.slug as string | null) || listingId
  try {
    expirePublicListingSurfacesAfterEdit(listingId, slug)
  } catch (error) {
    console.error("[mobile-api] listing edit revalidate failed", {
      listingId,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return { ok: true, data: { id: listingId, slug } }
}
