import { after, NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSafeRouteUser, resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { fetchListingForEditById, fetchOwnedListingForEdit } from "@/lib/db/listingEdit"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
  parseImpersonationCookie,
  serializeImpersonationCookie,
} from "@/lib/impersonation"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import {
  applyPublishedListingSideEffects,
  validateListingDraftPublishable,
} from "@/lib/services/publishListingDraft"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  listingVideosToUpdateOps,
  syncListingVideos,
} from "@/lib/services/sync-listing-videos"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

/** Owner updates must not change identity / visibility columns from the client. */
const OWNER_LISTING_UPDATE_FORBIDDEN = new Set([
  "id",
  "user_id",
  "created_at",
  "slug",
  "status",
  "hidden_from_site",
  "site_visibility_reason",
])

function listingFieldsForOwnerUpdate(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (OWNER_LISTING_UPDATE_FORBIDDEN.has(key)) continue
    next[key] = value
  }
  return next
}

/** Owner listing saves include photos + shipping columns; give the write time to finish. */
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  response.headers.set("Cache-Control", "private, no-store")

  const { supabase, user } = await getSafeRouteUser(request, response)
  if (!user) {
    return response
  }

  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const impersonationRaw = request.cookies.get(IMPERSONATION_COOKIE)?.value
    const impersonation = impersonationRaw
      ? parseImpersonationCookie(impersonationRaw)
      : null

    let listing = await fetchOwnedListingForEdit(supabase, idParsed.data, user.id)
    let impersonationCookieToSet: ReturnType<typeof serializeImpersonationCookie> | null = null
    let actorIsAdmin = false

    if (!listing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()

      actorIsAdmin = profile?.is_admin === true
      if (actorIsAdmin) {
        if (impersonation) {
          listing = await fetchOwnedListingForEdit(supabase, idParsed.data, impersonation.userId)
        }
        if (!listing) {
          try {
            listing = await fetchListingForEditById(createServiceRoleClient(), idParsed.data)
          } catch {
            listing = null
          }
        }
      }
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const ownerUserId = listing.user_id
    if (
      actorIsAdmin &&
      ownerUserId &&
      ownerUserId !== user.id &&
      impersonation?.userId === ownerUserId
    ) {
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", ownerUserId)
        .maybeSingle()
      impersonationCookieToSet = serializeImpersonationCookie({
        userId: ownerUserId,
        displayName:
          typeof sellerProfile?.display_name === "string" && sellerProfile.display_name.trim()
            ? sellerProfile.display_name.trim()
            : impersonation.displayName || "User",
        email:
          typeof sellerProfile?.email === "string"
            ? sellerProfile.email
            : impersonation.email ?? null,
      })
    }

    const ok = NextResponse.json(
      {
        data: {
          userId: ownerUserId,
          listing,
        },
      },
      { status: 200 },
    )
    ok.headers.set("Cache-Control", "private, no-store")
    response.cookies.getAll().forEach((cookie) => {
      ok.cookies.set({
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        domain: cookie.domain,
        expires: cookie.expires,
        maxAge: cookie.maxAge,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        priority: cookie.priority,
        partitioned: cookie.partitioned,
      })
    })
    if (impersonationCookieToSet) {
      ok.cookies.set(
        IMPERSONATION_COOKIE,
        impersonationCookieToSet,
        impersonationCookieOptions(),
      )
    }
    return ok
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}

/**
 * Seller-owned listing update. Route handler (not a Server Action) so Save on
 * /sell does not POST to the sell URL and abort the write.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdParamSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }
  const listingId = idParsed.data

  let body: {
    listing?: Record<string, unknown>
    removedImageIds?: string[]
    images?: {
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
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const listingData = body.listing
  if (!listingData || typeof listingData !== "object") {
    return NextResponse.json({ error: "Missing listing fields" }, { status: 400 })
  }

  const removedImageIds = body.removedImageIds ?? []
  const images = body.images ?? []
  const removedVideoIds = body.removedVideoIds ?? []
  const videos = body.videos ?? []
  const publishFromDraft = body.publishFromDraft === true

  const { data: existingListing, error: existingErr } = await supabase
    .from("listings")
    .select(
      "user_id, status, title, description, price, city, state, latitude, longitude, slug, local_pickup, shipping_available, section",
    )
    .eq("id", listingId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingErr || !existingListing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }
  if (existingListing.status === "sold") {
    return NextResponse.json({ error: "Sold listings cannot be edited" }, { status: 400 })
  }

  const listingFields = listingFieldsForOwnerUpdate(listingData)
  const publishingFromDraft = existingListing.status === "draft" && publishFromDraft

  if (publishingFromDraft) {
    const validationError = validateListingDraftPublishable({
      status: "draft",
      price:
        typeof listingFields.price === "number" ? listingFields.price : existingListing.price,
      description:
        typeof listingFields.description === "string"
          ? listingFields.description
          : existingListing.description,
      city: typeof listingFields.city === "string" ? listingFields.city : existingListing.city,
      state: typeof listingFields.state === "string" ? listingFields.state : existingListing.state,
      latitude:
        typeof listingFields.latitude === "number"
          ? listingFields.latitude
          : existingListing.latitude,
      longitude:
        typeof listingFields.longitude === "number"
          ? listingFields.longitude
          : existingListing.longitude,
      imageCount: images.length,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  const publishSlug = publishingFromDraft
    ? await generateUniqueListingSlug(
        supabase,
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

  let { data: updatedRow, error: updateError } = await supabase
    .from("listings")
    .update(updatePayload)
    .eq("id", listingId)
    .eq("user_id", user.id)
    .select("slug")
    .single()

  if (updateError && isListingDimensionDisplaySchemaCacheError(updateError)) {
    const retry = await supabase
      .from("listings")
      .update({
        ...withoutListingDimensionDisplayDbFields(listingFields),
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
      .eq("user_id", user.id)
      .select("slug")
      .single()
    updatedRow = retry.data
    updateError = retry.error
  }

  if (updateError) {
    console.error("[owned-edit] listing update error:", updateError)
    const message =
      typeof updateError.message === "string" && updateError.message.trim()
        ? updateError.message.trim()
        : "Failed to update listing"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (publishingFromDraft) {
    await recordListingVisibilityEvent(supabase, {
      listingId,
      hiddenFromSite: false,
      source: "publish_draft",
      actorUserId: user.id,
      note: "Published draft from sell edit",
    })
  }

  const slugTrim =
    updatedRow && typeof (updatedRow as { slug?: string }).slug === "string"
      ? String((updatedRow as { slug: string }).slug).trim()
      : publishingFromDraft
        ? (publishSlug ?? "")
        : String(existingListing.slug ?? "").trim()

  try {
    await syncListingImages(
      supabase,
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
    console.error("[owned-edit] listing image sync error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Failed to save listing photos",
      },
      { status: 500 },
    )
  }

  if (removedVideoIds.length > 0 || videos.length > 0) {
    try {
      await syncListingVideos(
        supabase,
        listingId,
        removedVideoIds,
        listingVideosToUpdateOps(videos),
      )
    } catch (error) {
      console.error("[owned-edit] listing video sync error:", error)
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Failed to save listing video",
        },
        { status: 500 },
      )
    }
  }

  const listingSection = String(listingData.section ?? existingListing.section ?? "")
  if (
    listingSection === "surfboards" &&
    body.catalog_snapshot &&
    typeof body.catalog_snapshot === "object"
  ) {
    const r = await upsertUserListingBoardModelDataFromSellForm(supabase, {
      listingId,
      sellerUserId: user.id,
      form: body.catalog_snapshot,
    })
    if (!r.ok) {
      console.warn("[owned-edit] user_listing_board_model_data:", r.error)
    }
  }

  if (publishingFromDraft) {
    after(() => {
      void applyPublishedListingSideEffects(supabase, listingId, user.id).catch((error) => {
        console.error("[owned-edit] publish side effects:", error)
      })
    })
  }

  return NextResponse.json({
    success: true,
    slug: slugTrim,
    published: publishingFromDraft,
  })
}
