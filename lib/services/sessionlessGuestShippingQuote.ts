import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  computePeerCheckoutTotalsUsd,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { sessionlessGuestShippingToProfileAddressRow } from "@/lib/checkout/sessionless-guest-stripe-payload"
import { profileAddressInputSchema } from "@/lib/address-input"

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

const bodySchema = z.object({
  listing_id: z.string().trim().min(1),
  guest_checkout: z.literal(true),
  shipping_address: profileAddressInputSchema,
})

export type SessionlessGuestQuoteResult =
  | {
      ok: true
      data: { itemPrice: number; shippingUsd: number; totalUsd: number; usedReswellQuote: boolean }
    }
  | { ok: false; error: string; status: number }

export async function quoteSessionlessGuestShipping(
  supabase: SupabaseClient,
  rawBody: unknown,
): Promise<SessionlessGuestQuoteResult> {
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request", status: 400 }
  }

  const { listing_id: listingId, shipping_address: shipIn } = parsed.data

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId.trim())
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .in("status", ["active", "pending_sale"])
    .maybeSingle()

  if (listingError || !listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const buyerAddress = sessionlessGuestShippingToProfileAddressRow(shipIn) as ProfileAddressRow

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listing as PeerListingForShippingQuote & { price: number | string },
    fulfillment: "shipping",
    buyerAddress,
  })

  if (!totals.ok) {
    return { ok: false, error: totals.error, status: 422 }
  }

  return {
    ok: true,
    data: {
      itemPrice: totals.itemPrice,
      shippingUsd: totals.shippingUsd,
      totalUsd: totals.totalUsd,
      usedReswellQuote: totals.usedReswellQuote,
    },
  }
}
