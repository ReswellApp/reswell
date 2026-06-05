import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { revalidateListingPublicDetailCatalog } from "@/lib/cache/revalidate-listing-public-detail"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE, parseImpersonationCookie } from "@/lib/impersonation"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { upsertUserListingBoardModelDataFromSellForm } from "@/lib/db/user-listing-board-model-data"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"
import type { SellFormBoardCatalogSlice } from "@/lib/utils/listing-board-catalog-snapshot"

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
  }

  if (!listingId || !listingData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data: existingListing, error: existingErr } = await service
    .from("listings")
    .select("user_id")
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

  const updatePayload = {
    ...listingFields,
    updated_at: new Date().toISOString(),
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

  const slugTrim =
    updatedRow && typeof (updatedRow as { slug?: string }).slug === "string"
      ? String((updatedRow as { slug: string }).slug).trim()
      : ""

  if (removedImageIds.length > 0) {
    const { data: removedRows } = await service
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .in("id", removedImageIds)
    const removedUrls: string[] = []
    for (const r of removedRows ?? []) {
      if (r.url?.trim()) removedUrls.push(r.url)
      if (r.thumbnail_url?.trim()) removedUrls.push(r.thumbnail_url)
    }
    if (removedUrls.length > 0) {
      await removeListingImageFilesFromStorage(service, removedUrls)
    }
    const { error: delErr } = await service
      .from("listing_images")
      .delete()
      .in("id", removedImageIds)
      .eq("listing_id", listingId)
    if (delErr) {
      console.error("[impersonate] listing_images delete error:", delErr)
    }
  }

  for (const img of images) {
    if (img.id) {
      const rowUpdate: {
        sort_order: number
        is_primary: boolean
        url?: string
        thumbnail_url?: string | null
      } = { sort_order: img.sort_order, is_primary: img.is_primary }
      const u = typeof img.url === "string" ? img.url.trim() : ""
      if (u) {
        rowUpdate.url = u
        rowUpdate.thumbnail_url =
          typeof img.thumbnail_url === "string" && img.thumbnail_url.trim()
            ? img.thumbnail_url.trim()
            : null
      }
      await service
        .from("listing_images")
        .update(rowUpdate)
        .eq("id", img.id)
        .eq("listing_id", listingId)
    } else if (img.url) {
      await service.from("listing_images").insert({
        listing_id: listingId,
        url: img.url,
        thumbnail_url: img.thumbnail_url ?? null,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
      })
    }
  }

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

  return NextResponse.json({ success: true, slug, seller_display_name: sellerDisplayName })
}
