import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe, getStripeCheckoutKeyConfigError } from "@/lib/stripe-server"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { computePeerCheckoutTotalsUsd } from "@/lib/services/peerListingShippingQuote"
import {
  sessionlessGuestPayloadToStripeMetadata,
  sessionlessGuestPaymentRequestSchema,
  sessionlessGuestShippingToProfileAddressRow,
} from "@/lib/checkout/sessionless-guest-stripe-payload"

const LISTING_SELECT = `
  id,
  user_id,
  title,
  price,
  section,
  shipping_available,
  local_pickup,
  shipping_price,
  board_shipping_cost_mode,
  status,
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

export type SessionlessGuestPaymentIntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string; status: number }

export async function createSessionlessGuestPaymentIntent(
  supabase: SupabaseClient,
  rawBody: unknown,
): Promise<SessionlessGuestPaymentIntentResult> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { ok: false, error: "Card payments are not configured", status: 503 }
  }

  const keyConfigError = getStripeCheckoutKeyConfigError()
  if (keyConfigError) {
    return { ok: false, error: keyConfigError, status: 503 }
  }

  const parsed = sessionlessGuestPaymentRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request", status: 400 }
  }

  const guest = parsed.data
  const listingIdTrim = guest.listing_id.trim()

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingIdTrim)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .single()

  if (listingError || !listing) {
    return { ok: false, error: "Listing not found or not available", status: 404 }
  }

  if (listing.section !== "surfboards") {
    return { ok: false, error: "This listing cannot be purchased here", status: 400 }
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    return { ok: false, error: "Listing has no fulfillment options", status: 400 }
  }

  const fulfillmentBody = guest.fulfillment === "shipping" || guest.fulfillment === "pickup" ? guest.fulfillment : null
  const fulfillment =
    lp && sa ? (fulfillmentBody === "shipping" || fulfillmentBody === "pickup" ? fulfillmentBody : null) : undefined

  if (lp && sa && !fulfillment) {
    return { ok: false, error: "Choose pickup or shipping for this listing", status: 400 }
  }

  const impliedFulfillment: "pickup" | "shipping" =
    lp && sa
      ? fulfillment === "shipping"
        ? "shipping"
        : "pickup"
      : !lp && sa
        ? "shipping"
        : "pickup"

  if (guest.fulfillment !== impliedFulfillment) {
    return { ok: false, error: "Fulfillment does not match this listing", status: 400 }
  }

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", listing.user_id)
    .maybeSingle()
  const sellerEm = typeof sellerProfile?.email === "string" ? sellerProfile.email.trim().toLowerCase() : ""
  const guestEm = guest.buyer_email.trim().toLowerCase()
  if (sellerEm && guestEm === sellerEm) {
    return { ok: false, error: "Cannot purchase your own listing", status: 400 }
  }

  let buyerAddress: ProfileAddressRow | null = null
  if (impliedFulfillment === "shipping" && guest.shipping) {
    buyerAddress = sessionlessGuestShippingToProfileAddressRow(guest.shipping)
  }

  const totals = await computePeerCheckoutTotalsUsd({
    listing: listing as Parameters<typeof computePeerCheckoutTotalsUsd>[0]["listing"],
    fulfillment: impliedFulfillment,
    buyerAddress,
  })
  if (!totals.ok) {
    return { ok: false, error: totals.error, status: 422 }
  }

  const amountCents = Math.round(totals.totalUsd * 100)
  if (amountCents < 50) {
    return { ok: false, error: "Amount is below the minimum charge", status: 400 }
  }

  const { listing_id: _listingId, guest_checkout: _gc, ...guestStripeCore } = guest

  let guestMeta: Record<string, string>
  try {
    guestMeta = sessionlessGuestPayloadToStripeMetadata(guestStripeCore)
  } catch {
    return { ok: false, error: "Checkout payload is too large", status: 400 }
  }

  try {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        listing_id: listing.id,
        fulfillment: impliedFulfillment,
        amount_cents: String(amountCents),
        ...(totals.usedReswellQuote
          ? { reswell_shipping_cents: String(Math.round(totals.shippingUsd * 100)) }
          : {}),
        ...guestMeta,
      },
      description: `Reswell — ${listing.title}`.slice(0, 1000),
    })

    const secret = paymentIntent.client_secret
    if (!secret) {
      return { ok: false, error: "Could not create payment", status: 500 }
    }
    return { ok: true, clientSecret: secret }
  } catch (err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string; statusCode?: number }
    console.error("[create-payment-intent] Stripe API error (guest):", {
      type: stripeErr.type,
      code: stripeErr.code,
      message: stripeErr.message,
      statusCode: stripeErr.statusCode,
    })
    return {
      ok: false,
      error: stripeErr.message ?? "Could not create payment",
      status: stripeErr.statusCode ?? 500,
    }
  }
}
