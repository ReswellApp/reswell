import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  computePeerCheckoutTotalsUsd,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"

export const dynamic = "force-dynamic"

const JSON_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const

export async function POST(request: Request) {
  const supabase = await createClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to get a shipping quote." },
      { status: 401, headers: JSON_NO_STORE_HEADERS },
    )
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
    return NextResponse.json(
      { error: "listing_id and address_id are required" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .in("status", ["active", "pending_sale"])
    .maybeSingle()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404, headers: JSON_NO_STORE_HEADERS })
  }

  /** Runtime select fragment loses Supabase's row inference; cast through `unknown` once. */
  const listingRow = listing as unknown as PeerListingForShippingQuote & {
    id: string
    user_id: string
    price: number | string
  }

  if (listingRow.user_id === user.id) {
    return NextResponse.json(
      { error: "Cannot quote your own listing" },
      { status: 400, headers: JSON_NO_STORE_HEADERS },
    )
  }

  const { data: addr, error: addrErr } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("profile_id", user.id)
    .maybeSingle()

  if (addrErr || !addr) {
    return NextResponse.json({ error: "Address not found" }, { status: 400, headers: JSON_NO_STORE_HEADERS })
  }

  const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, listingRow.user_id)

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listingRow,
    fulfillment: "shipping",
    buyerAddress: addr as ProfileAddressRow,
    diagnosticTag: `checkout-quote:${listingRow.id}`,
    sellerShipFromName,
  })

  if (!totals.ok) {
    return NextResponse.json({ error: totals.error }, { status: 422, headers: JSON_NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      data: {
        itemPrice: totals.itemPrice,
        shippingUsd: totals.shippingUsd,
        totalUsd: totals.totalUsd,
        usedReswellQuote: totals.usedReswellQuote,
      },
    },
    { headers: JSON_NO_STORE_HEADERS },
  )
}
