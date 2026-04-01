import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE, parseImpersonationCookie } from "@/lib/impersonation"
import { slugify } from "@/lib/slugify"

export async function POST(request: NextRequest) {
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

  const targetUserId = impersonation.userId

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const body = await request.json()
  const { listing: listingData, images = [] } = body

  if (!listingData?.title || listingData?.price == null) {
    return NextResponse.json({ error: "Missing required listing fields" }, { status: 400 })
  }

  if (
    listingData.section === "surfboards" &&
    (typeof listingData.city !== "string" ||
      !listingData.city.trim() ||
      typeof listingData.state !== "string" ||
      !listingData.state.trim())
  ) {
    return NextResponse.json(
      { error: "City and state are required for surfboard listings" },
      { status: 400 },
    )
  }

  const baseSlug = slugify(listingData.title)
  let slug = baseSlug
  const { count } = await service
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", baseSlug)
  if (count) {
    for (let i = 2; i < 100; i++) {
      const candidate = `${baseSlug}-${i}`
      const { count: c } = await service
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("slug", candidate)
      if (!c) {
        slug = candidate
        break
      }
    }
  }

  const { data: listing, error: listingError } = await service
    .from("listings")
    .insert({
      ...listingData,
      user_id: targetUserId,
      slug,
      status: "active",
    })
    .select("id, slug")
    .single()

  if (listingError || !listing) {
    console.error("[impersonate] listing insert error:", listingError)
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 })
  }

  if (images.length > 0) {
    const imageInserts = (
      images as { url: string; thumbnail_url?: string | null }[]
    ).map((row, index: number) => ({
      listing_id: listing.id,
      url: row.url,
      thumbnail_url: row.thumbnail_url ?? null,
      is_primary: index === 0,
      sort_order: index,
    }))
    const { error: imgErr } = await service.from("listing_images").insert(imageInserts)
    if (imgErr) {
      console.error("[impersonate] listing_images insert error:", imgErr)
    }
  }

  const { data: sellerProfile } = await service
    .from("profiles")
    .select("display_name")
    .eq("id", targetUserId)
    .single()

  const sellerDisplayName =
    (sellerProfile?.display_name && String(sellerProfile.display_name).trim()) || "Seller"

  return NextResponse.json({
    success: true,
    listing_id: listing.id,
    slug: listing.slug,
    seller_display_name: sellerDisplayName,
  })
}
