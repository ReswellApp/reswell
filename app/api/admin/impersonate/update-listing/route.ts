import { after, NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { revalidateListingPublicDetailCatalog } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE, parseImpersonationCookie } from "@/lib/impersonation"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  listingVideosToUpdateOps,
  syncListingVideos,
} from "@/lib/services/sync-listing-videos"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import {
  applyPublishedListingSideEffects,
  validateListingDraftPublishable,
} from "@/lib/services/publishListingDraft"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"

/** Admin impersonation saves include photos + shipping columns; give the write time to finish. */
export const maxDuration = 60

function impersonateListingWriteErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback
  const o = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
  const parts = [o.message, o.details, o.hint]
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim())
  const blob = parts.join(" ").toLowerCase()
  if (
    blob.includes("shipping_package_band") ||
    blob.includes("shipping_package_tier") ||
    blob.includes("board_shipping_cost_mode") ||
    blob.includes("shipping_packed")
  ) {
    return "Shipping details could not be saved. Check box size, weight, and shipping options, then try again."
  }
  const first = parts[0]
  if (first) return first
  return fallback
}

export async function PUT(request: NextRequest) {
  try {
    return await putImpersonatedListing(request)
  } catch (error) {
    console.error("[impersonate] update-listing failed:", error)
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Failed to update listing"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function putImpersonatedListing(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const raw = request.cookies.get(IMPERSONATION_COOKIE)?.value
  const impersonation = raw ? parseImpersonationCookie(raw) : null

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const body = await request.json()
  const {
    listingId,
    listing: listingData,
    removedImageIds = [],
    images = [],
    removedVideoIds = [],
    videos = [],
    catalog_snapshot,
    publishFromDraft = false,
  } = body as {
    listingId: string
    listing: Record<string, unknown>
    removedImageIds: string[]
    images: {
      id?: string
      url?: string
      thumbnail_url?: string | null
      is_primary: boolean
      sort_order: number
    }[]
    removedVideoIds?: string[]
    videos?: Array<{
      id?: string
      url: string
      thumbnailUrl?: string | null
      contentType?: string | null
      durationSeconds?: number | null
      byteSize?: number | null
      sortOrder?: number
    }>
    catalog_snapshot?: SellFormBoardCatalogSlice
    publishFromDraft?: boolean
  }

  if (!listingId || !listingData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data: existingListing, error: existingErr } = await service
    .from("listings")
    .select(
      "user_id, status, title, description, price, city, state, latitude, longitude, slug, local_pickup, shipping_available, section",
    )
    .eq("id", listingId)
    .single()

  if (existingErr || !existingListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  /**
   * Admins may save any listing. A matching impersonation cookie is optional —
   * stale or missing cookies were failing Save after admin → Edit listing.
   */
  const sellerUserId = existingListing.user_id

  const { slug: _listingSlugFromBody, ...listingFields } = listingData as Record<string, unknown> & {
    slug?: unknown
  }

  const publishingFromDraft =
    existingListing.status === "draft" && publishFromDraft === true

  if (publishingFromDraft) {
    const mergedForValidation = {
      status: "draft" as const,
      price:
        typeof listingFields.price === "number"
          ? listingFields.price
          : existingListing.price,
      description:
        typeof listingFields.description === "string"
          ? listingFields.description
          : existingListing.description,
      city:
        typeof listingFields.city === "string" ? listingFields.city : existingListing.city,
      state:
        typeof listingFields.state === "string" ? listingFields.state : existingListing.state,
      latitude:
        typeof listingFields.latitude === "number"
          ? listingFields.latitude
          : existingListing.latitude,
      longitude:
        typeof listingFields.longitude === "number"
          ? listingFields.longitude
          : existingListing.longitude,
      imageCount: images.length,
    }
    const validationError = validateListingDraftPublishable(mergedForValidation)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  const publishSlug = publishingFromDraft
    ? await generateUniqueListingSlug(
        service,
        typeof listingFields.title === "string" && listingFields.title.trim()
          ? listingFields.title.trim()
          : String(existingListing.title ?? "listing"),
      )
    : null

  const updatePayload = {
    ...listingFields,
    updated_at: new Date().toISOString(),
    ...(publishingFromDraft
      ? {
          status: "active" as const,
          hidden_from_site: false,
          site_visibility_reason: null,
          slug: publishSlug ?? undefined,
        }
      : {}),
  }
  let { data: updatedRow, error: updateError } = await service
    .from("listings")
    .update(updatePayload)
    .eq("id", listingId)
    .select("slug")
    .single()

  if (updateError && isListingDimensionDisplaySchemaCacheError(updateError)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[impersonate] listings missing dimension display columns; retrying update without them.",
      )
    }
    const retry = await service
      .from("listings")
      .update({
        ...withoutListingDimensionDisplayDbFields(listingFields as Record<string, unknown>),
        updated_at: new Date().toISOString(),
        ...(publishingFromDraft
          ? {
              status: "active" as const,
              hidden_from_site: false,
              site_visibility_reason: null,
              slug: publishSlug ?? undefined,
            }
          : {}),
      })
      .eq("id", listingId)
      .select("slug")
      .single()
    updatedRow = retry.data
    updateError = retry.error
  }

  if (updateError) {
    console.error("[impersonate] listing update error:", updateError)
    return NextResponse.json(
      { error: impersonateListingWriteErrorMessage(updateError, "Failed to update listing") },
      { status: 500 },
    )
  }

  if (publishingFromDraft) {
    await recordListingVisibilityEvent(service, {
      listingId,
      hiddenFromSite: false,
      source: "impersonate_update",
      actorUserId: user.id,
      note: "Published draft while impersonating",
    })
  }

  const slugTrim =
    updatedRow && typeof (updatedRow as { slug?: string }).slug === "string"
      ? String((updatedRow as { slug: string }).slug).trim()
      : publishingFromDraft
        ? (publishSlug ?? "")
        : ""

  try {
    await syncListingImages(
      service,
      listingId,
      removedImageIds,
      images.map((img) => ({
        id: img.id,
        url: typeof img.url === "string" ? img.url : "",
        thumbnailUrl: img.thumbnail_url ?? null,
        isPrimary: img.is_primary,
        sortOrder: img.sort_order,
      })),
    )
  } catch (error) {
    console.error("[impersonate] listing image sync error:", error)
  }

  if (removedVideoIds.length > 0 || videos.length > 0) {
    try {
      await syncListingVideos(
        service,
        listingId,
        removedVideoIds,
        listingVideosToUpdateOps(videos),
      )
    } catch (error) {
      console.error("[impersonate] listing video sync error:", error)
    }
  }

  const listingSection = String(
    listingData?.section ?? (existingListing as { section?: string | null }).section ?? "",
  )
  if (listingSection === "surfboards" && catalog_snapshot && typeof catalog_snapshot === "object") {
    const r = await upsertUserListingBoardModelDataFromSellForm(service, {
      listingId,
      sellerUserId,
      form: catalog_snapshot,
    })
    if (!r.ok) {
      console.warn("[impersonate update-listing] user_listing_board_model_data:", r.error)
    }
  }

  const { data: sellerProfile } = await service
    .from("profiles")
    .select("display_name, email")
    .eq("id", sellerUserId)
    .single()

  const sellerDisplayName =
    (sellerProfile?.display_name && String(sellerProfile.display_name).trim()) || "Seller"
  const sellerEmail =
    (typeof sellerProfile?.email === "string" && sellerProfile.email.trim()
      ? sellerProfile.email.trim()
      : null) ??
    impersonation?.email ??
    null

  const slug = slugTrim

  after(() => {
    try {
      if (slug.trim()) {
        revalidatePath(`/l/${slug.trim()}`, "page")
        revalidateListingPublicDetailCatalog()
      }
      if (listingSection === "fins") {
        revalidatePath("/fins")
      }
    } catch (error) {
      console.error("[impersonate] listing path revalidate error:", error)
    }
  })

  if (publishingFromDraft) {
    const primary = images.find((img) => img.url?.trim())
    void trackKlaviyoListingCreated({
      sellerUserId: existingListing.user_id,
      sellerEmail,
      listingId,
      title:
        typeof listingFields.title === "string" && listingFields.title.trim()
          ? listingFields.title.trim()
          : String(existingListing.title ?? "Listing"),
      price: Number(
        typeof listingFields.price === "number"
          ? listingFields.price
          : existingListing.price ?? 0,
      ),
      photoUrl: primary?.url?.trim() ?? null,
      localPickup:
        typeof listingFields.local_pickup === "boolean"
          ? listingFields.local_pickup
          : existingListing.local_pickup,
      shippingAvailable:
        typeof listingFields.shipping_available === "boolean"
          ? listingFields.shipping_available
          : existingListing.shipping_available,
    })
    void trackFirstTimeSellerForListingIfNeeded(service, {
      listingId,
      sellerUserId: existingListing.user_id,
      sellerEmail,
    })
    after(() => {
      void applyPublishedListingSideEffects(service, listingId, existingListing.user_id).catch(
        (error) => {
          console.error("[impersonate] publish side effects:", error)
        },
      )
    })
  } else {
    void syncListingToGoogleMerchantBestEffort(service, listingId)
    after(() => {
      void revalidateSellersAfterListingChange(service, existingListing.user_id).catch((error) => {
        console.error("[impersonate] sellers revalidate error:", error)
      })
    })
  }

  return NextResponse.json({
    success: true,
    slug,
    published: publishingFromDraft,
    seller_display_name: sellerDisplayName,
  })
}
