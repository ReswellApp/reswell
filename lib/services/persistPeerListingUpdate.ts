import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import { omitClientAutoPriceDropSchedule } from "@/lib/listing-auto-price-drop"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { overlayListingRowWithDropoffParcel } from "@/lib/services/listingDropoffParcel"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"
import {
  applyPublishedListingSideEffects,
  validateListingDraftPublishable,
} from "@/lib/services/publishListingDraft"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  listingVideosToUpdateOps,
  syncListingVideos,
} from "@/lib/services/sync-listing-videos"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { listingFieldsForPeerUpdate } from "@/lib/utils/listing-update-actor"

export { listingFieldsForPeerUpdate } from "@/lib/utils/listing-update-actor"

export type PersistPeerListingExistingRow = {
  user_id: string
  status: string | null
  title: string | null
  description: string | null
  price: number | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  slug: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  section: string | null
}

export type PersistPeerListingImageOp = {
  id?: string
  url?: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

export type PersistPeerListingVideoOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  contentType?: string | null
  durationSeconds?: number | null
  byteSize?: number | null
  sortOrder?: number
}

export type PersistPeerListingUpdateResult =
  | { ok: true; slug: string; published: boolean }
  | { ok: false; status: number; error: string }

/**
 * Shared listing write for seller-owned edits and admin edits of someone else.
 * Owner updates stay constrained to `user_id`. Admin updates never write `user_id`.
 */
export async function persistPeerListingUpdate(input: {
  db: SupabaseClient
  listingId: string
  ownerUserId: string
  actorUserId: string
  constrainToOwner: boolean
  existingListing: PersistPeerListingExistingRow
  listingData: Record<string, unknown>
  removedImageIds: string[]
  images: PersistPeerListingImageOp[]
  removedVideoIds: string[]
  videos: PersistPeerListingVideoOp[]
  catalogSnapshot?: SellFormBoardCatalogSlice
  publishFromDraft: boolean
}): Promise<PersistPeerListingUpdateResult> {
  if (input.existingListing.status === "sold") {
    return { ok: false, status: 400, error: "Sold listings cannot be edited" }
  }

  const listingFields = await overlayListingRowWithDropoffParcel(
    input.db,
    {
      dropoffLocationId:
        typeof input.listingData.dropoff_location_id === "string"
          ? input.listingData.dropoff_location_id
          : null,
      boardLength: input.catalogSnapshot?.boardLength,
      boardWidthInches: input.catalogSnapshot?.boardWidthInches,
    },
    omitClientAutoPriceDropSchedule(listingFieldsForPeerUpdate(input.listingData)),
  )
  const publishingFromDraft =
    input.existingListing.status === "draft" && input.publishFromDraft

  if (publishingFromDraft) {
    const validationError = validateListingDraftPublishable({
      status: "draft",
      price:
        typeof listingFields.price === "number"
          ? listingFields.price
          : input.existingListing.price,
      description:
        typeof listingFields.description === "string"
          ? listingFields.description
          : input.existingListing.description,
      city:
        typeof listingFields.city === "string"
          ? listingFields.city
          : input.existingListing.city,
      state:
        typeof listingFields.state === "string"
          ? listingFields.state
          : input.existingListing.state,
      latitude:
        typeof listingFields.latitude === "number"
          ? listingFields.latitude
          : input.existingListing.latitude,
      longitude:
        typeof listingFields.longitude === "number"
          ? listingFields.longitude
          : input.existingListing.longitude,
      imageCount: input.images.length,
    })
    if (validationError) {
      return { ok: false, status: 400, error: validationError }
    }
  }

  const publishSlug = publishingFromDraft
    ? await generateUniqueListingSlug(
        input.db,
        typeof listingFields.title === "string" && listingFields.title.trim()
          ? listingFields.title.trim()
          : String(input.existingListing.title ?? "listing"),
      )
    : null

  const publishPatch = publishingFromDraft
    ? {
        status: "active" as const,
        hidden_from_site: false,
        site_visibility_reason: null,
        slug: publishSlug ?? undefined,
      }
    : {}

  const applyUpdate = async (fields: Record<string, unknown>) => {
    let query = input.db
      .from("listings")
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
        ...publishPatch,
      })
      .eq("id", input.listingId)
    if (input.constrainToOwner) {
      query = query.eq("user_id", input.ownerUserId)
    }
    return query.select("slug").single()
  }

  let { data: updatedRow, error: updateError } = await applyUpdate(listingFields)

  if (updateError && isListingDimensionDisplaySchemaCacheError(updateError)) {
    const retry = await applyUpdate(
      withoutListingDimensionDisplayDbFields(listingFields),
    )
    updatedRow = retry.data
    updateError = retry.error
  }

  if (updateError) {
    console.error("[listing-update] listing update error:", updateError)
    const message =
      typeof updateError.message === "string" && updateError.message.trim()
        ? updateError.message.trim()
        : "Failed to update listing"
    return { ok: false, status: 500, error: message }
  }

  if (publishingFromDraft) {
    await recordListingVisibilityEvent(input.db, {
      listingId: input.listingId,
      hiddenFromSite: false,
      source: input.constrainToOwner ? "publish_draft" : "impersonate_update",
      actorUserId: input.actorUserId,
      note: input.constrainToOwner
        ? "Published draft from sell edit"
        : "Published draft while impersonating",
    })
  }

  const slugTrim =
    updatedRow && typeof (updatedRow as { slug?: string }).slug === "string"
      ? String((updatedRow as { slug: string }).slug).trim()
      : publishingFromDraft
        ? (publishSlug ?? "")
        : String(input.existingListing.slug ?? "").trim()

  try {
    await syncListingImages(
      input.db,
      input.listingId,
      input.removedImageIds,
      input.images.map((img) => ({
        id: img.id,
        url: typeof img.url === "string" ? img.url : "",
        thumbnailUrl: img.thumbnail_url ?? null,
        isPrimary: img.is_primary,
        sortOrder: img.sort_order,
      })),
    )
  } catch (error) {
    console.error("[listing-update] listing image sync error:", error)
    return {
      ok: false,
      status: 500,
      error:
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Failed to save listing photos",
    }
  }

  if (input.removedVideoIds.length > 0 || input.videos.length > 0) {
    try {
      await syncListingVideos(
        input.db,
        input.listingId,
        input.removedVideoIds,
        listingVideosToUpdateOps(input.videos),
      )
    } catch (error) {
      console.error("[listing-update] listing video sync error:", error)
      return {
        ok: false,
        status: 500,
        error:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Failed to save listing video",
      }
    }
  }

  const listingSection = String(
    input.listingData.section ?? input.existingListing.section ?? "",
  )
  if (
    listingSection === "surfboards" &&
    input.catalogSnapshot &&
    typeof input.catalogSnapshot === "object"
  ) {
    const r = await upsertUserListingBoardModelDataFromSellForm(input.db, {
      listingId: input.listingId,
      sellerUserId: input.ownerUserId,
      form: input.catalogSnapshot,
    })
    if (!r.ok) {
      console.warn("[listing-update] user_listing_board_model_data:", r.error)
    }
  }

  return {
    ok: true,
    slug: slugTrim,
    published: publishingFromDraft,
  }
}

export function schedulePublishedListingSideEffects(
  db: SupabaseClient,
  listingId: string,
  sellerUserId: string,
): Promise<void> {
  return applyPublishedListingSideEffects(db, listingId, sellerUserId)
}
