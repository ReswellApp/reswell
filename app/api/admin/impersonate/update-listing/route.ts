import { NextRequest, NextResponse } from "next/server"
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
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import {
  applyPublishedListingSideEffects,
  validateListingDraftPublishable,
} from "@/lib/services/publishListingDraft"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"

export async function PUT(request: NextRequest) {
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
  if (!raw) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 })
  }

  const impersonation = parseImpersonationCookie(raw)
  if (!impersonation) {
    return NextResponse.json({ error: "Invalid impersonation cookie" }, { status: 400 })
  }

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
    catalog_snapshot?: SellFormBoardCatalogSlice
    publishFromDraft?: boolean
  }

  if (!listingId || !listingData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data: existingListing, error: existingErr } = await service
    .from("listings")
    .select(
      "user_id, status, title, description, price, city, state, latitude, longitude, slug, local_pickup, shipping_available",
    )
    .eq("id", listingId)
    .single()

  if (existingErr || !existingListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (existingListing.user_id !== impersonation.userId) {
    return NextResponse.json(
      {
        error:
          "Impersonation target does not own this listing. Re-impersonate that listing's seller from admin, or clear impersonation if you are signed in as the seller.",
      },
      { status: 403 },
    )
  }

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
      })
      .eq("id", listingId)
      .select("slug")
      .single()
    updatedRow = retry.data
    updateError = retry.error
  }

  if (updateError) {
    console.error("[impersonate] listing update error:", updateError)
    return NextResponse.json({ error: "Failed to update listing" }, { status: 500 })
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

  if (
    String(listingData?.section ?? "") === "surfboards" &&
    catalog_snapshot &&
    typeof catalog_snapshot === "object"
  ) {
    const r = await upsertUserListingBoardModelDataFromSellForm(supabase, {
      listingId,
      sellerUserId: impersonation.userId,
      form: catalog_snapshot,
    })
    if (!r.ok) {
      console.warn("[impersonate update-listing] user_listing_board_model_data:", r.error)
    }
  }

  const { data: sellerProfile } = await service
    .from("profiles")
    .select("display_name")
    .eq("id", existingListing.user_id)
    .single()

  const sellerDisplayName =
    (sellerProfile?.display_name && String(sellerProfile.display_name).trim()) || "Seller"

  const slug = slugTrim

  if (slug.trim()) {
    revalidatePath(`/l/${slug.trim()}`, "page")
    revalidateListingPublicDetailCatalog()
  }
  if (String(listingData?.section ?? "") === "fins") {
    revalidatePath("/fins")
  }

  if (publishingFromDraft) {
    const primary = images.find((img) => img.url?.trim())
    void trackKlaviyoListingCreated({
      sellerUserId: existingListing.user_id,
      sellerEmail: impersonation.email,
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
    await applyPublishedListingSideEffects(service, listingId, existingListing.user_id)
  } else {
    void syncListingToGoogleMerchantBestEffort(service, listingId)
    await revalidateSellersAfterListingChange(service, existingListing.user_id)
  }

  return NextResponse.json({
    success: true,
    slug,
    published: publishingFromDraft,
    seller_display_name: sellerDisplayName,
  })
}
