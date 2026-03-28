import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE, parseImpersonationCookie } from "@/lib/impersonation"
import { slugify } from "@/lib/slugify"

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
  } = body as {
    listingId: string
    listing: Record<string, unknown>
    removedImageIds: string[]
    images: { id?: string; url?: string; is_primary: boolean; sort_order: number }[]
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

  const baseSlug = slugify(listingData.title as string)
  let slug = baseSlug
  const { count } = await service
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", baseSlug)
    .neq("id", listingId)
  if (count) {
    for (let i = 2; i < 100; i++) {
      const candidate = `${baseSlug}-${i}`
      const { count: c } = await service
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("slug", candidate)
        .neq("id", listingId)
      if (!c) {
        slug = candidate
        break
      }
    }
  }

  const { error: updateError } = await service
    .from("listings")
    .update({
      ...listingData,
      slug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)

  if (updateError) {
    console.error("[impersonate] listing update error:", updateError)
    return NextResponse.json({ error: "Failed to update listing" }, { status: 500 })
  }

  if (removedImageIds.length > 0) {
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
      await service
        .from("listing_images")
        .update({ sort_order: img.sort_order, is_primary: img.is_primary })
        .eq("id", img.id)
        .eq("listing_id", listingId)
    } else if (img.url) {
      await service.from("listing_images").insert({
        listing_id: listingId,
        url: img.url,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
      })
    }
  }

  const { data: sellerProfile } = await service
    .from("profiles")
    .select("display_name")
    .eq("id", existingListing.user_id)
    .single()

  const sellerDisplayName =
    (sellerProfile?.display_name && String(sellerProfile.display_name).trim()) || "Seller"

  return NextResponse.json({ success: true, slug, seller_display_name: sellerDisplayName })
}
