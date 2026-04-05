import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"

/**
 * Called from the sell flow after a client-side listing insert so we can fire Klaviyo server-side.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { listing_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const listingId = typeof body.listing_id === "string" ? body.listing_id.trim() : ""
  if (!listingId) {
    return NextResponse.json({ error: "listing_id required" }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, user_id, title, price")
    .eq("id", listingId)
    .maybeSingle()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (listing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: firstImage } = await supabase
    .from("listing_images")
    .select("url, thumbnail_url")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const photoUrl =
    (firstImage?.thumbnail_url && String(firstImage.thumbnail_url).trim()) ||
    (firstImage?.url && String(firstImage.url).trim()) ||
    null

  await trackKlaviyoListingCreated({
    sellerUserId: user.id,
    sellerEmail: user.email ?? null,
    listingId: listing.id,
    title: String(listing.title ?? ""),
    price: typeof listing.price === "number" ? listing.price : Number(listing.price),
    photoUrl,
  })

  return NextResponse.json({ ok: true })
}
