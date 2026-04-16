import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  computePeerCheckoutTotalsUsd,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"

export const dynamic = "force-dynamic"

const LISTING_SELECT = `
  id,
  user_id,
  price,
  shipping_available,
  local_pickup,
  shipping_price,
  board_shipping_cost_mode,
  latitude,
  longitude,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  length_feet,
  length_inches,
  length_inches_display,
  width,
  width_inches_display,
  thickness,
  thickness_inches_display,
  volume,
  volume_display
`

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to get a shipping quote." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const listingId =
    body && typeof body === "object" && "listing_id" in body
      ? String((body as { listing_id?: unknown }).listing_id ?? "").trim()
      : ""
  const addressId =
    body && typeof body === "object" && "address_id" in body
      ? String((body as { address_id?: unknown }).address_id ?? "").trim()
      : ""

  if (!listingId || !addressId) {
    return NextResponse.json({ error: "listing_id and address_id are required" }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .in("status", ["active", "pending_sale"])
    .maybeSingle()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if ((listing as { user_id: string }).user_id === user.id) {
    return NextResponse.json({ error: "Cannot quote your own listing" }, { status: 400 })
  }

  const { data: addr, error: addrErr } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("profile_id", user.id)
    .maybeSingle()

  if (addrErr || !addr) {
    return NextResponse.json({ error: "Address not found" }, { status: 400 })
  }

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listing as PeerListingForShippingQuote & { price: number | string },
    fulfillment: "shipping",
    buyerAddress: addr as ProfileAddressRow,
  })

  if (!totals.ok) {
    return NextResponse.json({ error: totals.error }, { status: 422 })
  }

  return NextResponse.json({
    data: {
      itemPrice: totals.itemPrice,
      shippingUsd: totals.shippingUsd,
      totalUsd: totals.totalUsd,
      usedReswellQuote: totals.usedReswellQuote,
    },
  })
}
