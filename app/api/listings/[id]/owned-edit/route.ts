import { after, NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSafeRouteUser, resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { fetchListingForEditById, fetchOwnedListingForEdit } from "@/lib/db/listingEdit"
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
  parseImpersonationCookie,
  serializeImpersonationCookie,
} from "@/lib/impersonation"
import {
  persistPeerListingUpdate,
  schedulePublishedListingSideEffects,
  type PersistPeerListingExistingRow,
  type PersistPeerListingImageOp,
  type PersistPeerListingVideoOp,
} from "@/lib/services/persistPeerListingUpdate"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"
import { resolveListingUpdateActor } from "@/lib/utils/listing-update-actor"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

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

  const { data: ownedListing, error: ownedErr } = await supabase
    .from("listings")
    .select(
      "user_id, status, title, description, price, city, state, latitude, longitude, slug, local_pickup, shipping_available, section",
    )
    .eq("id", listingId)
    .eq("user_id", user.id)
    .maybeSingle()

  let existingListing = ownedListing as PersistPeerListingExistingRow | null
  let writeDb = supabase
  let ownerUserId = user.id
  let constrainToOwner = true

  if (ownedErr || !existingListing) {
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    const actorIsAdmin = actorProfile?.is_admin === true
    if (!actorIsAdmin) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    let service
    try {
      service = createServiceRoleClient()
    } catch {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const { data: adminListing, error: adminErr } = await service
      .from("listings")
      .select(
        "user_id, status, title, description, price, city, state, latitude, longitude, slug, local_pickup, shipping_available, section",
      )
      .eq("id", listingId)
      .maybeSingle()

    if (adminErr || !adminListing?.user_id) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const actor = resolveListingUpdateActor({
      actorIsAdmin: true,
      actorUserId: user.id,
      listingOwnerId: String(adminListing.user_id),
    })
    if (actor === "forbidden") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    existingListing = adminListing as PersistPeerListingExistingRow
    ownerUserId = String(adminListing.user_id)
    if (actor === "owner") {
      writeDb = supabase
      constrainToOwner = true
    } else {
      writeDb = service
      constrainToOwner = false
    }
  }

  const result = await persistPeerListingUpdate({
    db: writeDb,
    listingId,
    ownerUserId,
    actorUserId: user.id,
    constrainToOwner,
    existingListing,
    listingData,
    removedImageIds,
    images: images as PersistPeerListingImageOp[],
    removedVideoIds,
    videos: videos as PersistPeerListingVideoOp[],
    catalogSnapshot: body.catalog_snapshot,
    publishFromDraft,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.published) {
    after(() => {
      void schedulePublishedListingSideEffects(writeDb, listingId, ownerUserId).catch((error) => {
        console.error("[owned-edit] publish side effects:", error)
      })
    })
  }

  // Expire `/l` before the save response returns. The page is hourly ISR and
  // otherwise keeps the previous shipping mode after Edit → Save → refresh.
  try {
    revalidateListingDetailPage(listingId, result.slug)
  } catch (error) {
    console.error("[owned-edit] listing detail revalidate:", error)
  }

  return NextResponse.json({
    success: true,
    slug: result.slug,
    published: result.published,
  })
}
