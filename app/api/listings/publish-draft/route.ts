import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { listingDetailHref } from "@/lib/listing-href"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const listingId =
    body &&
    typeof body === "object" &&
    typeof (body as { listing_id?: unknown }).listing_id === "string"
      ? (body as { listing_id: string }).listing_id.trim()
      : ""

  if (!listingId) {
    return NextResponse.json({ error: "listing_id is required" }, { status: 400 })
  }

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select(
      `
      id,
      user_id,
      status,
      slug,
      section,
      title,
      price,
      listing_images (url, thumbnail_url, is_primary, sort_order)
    `,
    )
    .eq("id", listingId)
    .maybeSingle()

  if (fetchError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (listing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (listing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft listings can be published from this flow" },
      { status: 400 },
    )
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to publish listing" },
      { status: 500 },
    )
  }

  try {
    await syncListingToIndex(supabase, listingId)
  } catch {
    // ES optional
  }

  const imgs = (listing.listing_images ?? []) as Array<{
    url?: string | null
    thumbnail_url?: string | null
    is_primary?: boolean | null
    sort_order?: number | null
  }>
  const sorted = [...imgs].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0
    const bp = b.is_primary ? 1 : 0
    if (ap !== bp) return bp - ap
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const first = sorted[0]
  const photoUrl =
    first?.thumbnail_url?.trim() || first?.url?.trim() || null

  void trackKlaviyoListingCreated({
    sellerUserId: user.id,
    sellerEmail: user.email ?? null,
    listingId,
    title: typeof listing.title === "string" ? listing.title : "",
    price: Number(listing.price),
    photoUrl,
  })

  const detailHref = listingDetailHref({
    id: listingId,
    slug: typeof listing.slug === "string" ? listing.slug : null,
    section: typeof listing.section === "string" ? listing.section : undefined,
  })

  return NextResponse.json({ listingDetailHref: detailHref })
}
