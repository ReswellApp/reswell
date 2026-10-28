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
import { verifyListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"

const EDITABLE_STATUSES = new Set(["active", "pending_sale", "draft", "delinquent"])

function ownedListingImage(url: string, userId: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) return false
  return url.startsWith(listingObjectPublicUrl(supabaseUrl, `${userId}/`))
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

  const publishInput: MobileSellPublish = { ...parsed.data, draft_id: null }
  const built = mobileSellListingFields(publishInput)
  if (!built.ok) return { ok: false, status: 400, error: built.error }

  if (publishInput.images.length < 1) {
    return { ok: false, status: 400, error: "Add at least one photo" }
  }
  if (publishInput.images.some((image) => !image.url || !image.thumbnail_url)) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  if (
    publishInput.images.some(
      (image) => !ownedListingImage(image.url, userId) || !ownedListingImage(image.thumbnail_url, userId),
    )
  ) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  for (const image of publishInput.images) {
    const ok = await verifyListingImageObjectsExist(image.url, image.thumbnail_url)
    if (!ok) return { ok: false, status: 400, error: "Upload the listing photos again" }
  }

  const updated = await supabase
    .from("listings")
    .update({ ...built.fields })
    .eq("id", listingId)
    .eq("user_id", userId)
  if (updated.error) {
    return { ok: false, status: 400, error: "Couldn't save this listing" }
  }

  const imageError = await replaceListingImages(supabase, listingId, publishInput.images)
  if (imageError) return { ok: false, status: 400, error: imageError }

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
