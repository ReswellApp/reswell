import {
  mobileCreateOfferPaymentBodySchema,
  mobileCreateOfferPaymentSchema,
  mobileCreateOfferResultSchema,
  type MobileCreateOfferPayment,
  type MobileCreateOfferResult,
} from "@reswell/api-contract"
import { revalidatePath } from "next/cache"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { captureServerEvent } from "@/lib/posthog-server"
import { createListingOffer } from "@/lib/services/createListingOffer"
import { createOfferAuthorizationPaymentIntent } from "@/lib/services/listingOfferAuthorization"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createListingOfferBodySchema } from "@/lib/validations/create-listing-offer"

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export async function createMobileListingOfferPayment(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  body: unknown,
): Promise<MobileApiResult<MobileCreateOfferPayment>> {
  const parsed = mobileCreateOfferPaymentBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Enter a valid offer amount" }

  const result = await createOfferAuthorizationPaymentIntent(supabase, user, listingId, parsed.data)
  if (!result.ok) return { ok: false, status: result.status, error: result.error }

  const mapped = mobileCreateOfferPaymentSchema.safeParse({
    client_secret: result.clientSecret,
    payment_intent_id: result.paymentIntentId,
    item_usd: result.itemUsd,
    shipping_usd: result.shippingUsd,
    total_usd: result.totalUsd,
    total_label: money(result.totalUsd),
  })
  if (!mapped.success) return { ok: false, status: 500, error: "Could not start offer payment" }
  return { ok: true, data: mapped.data }
}

export async function createMobileListingOffer(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  body: unknown,
): Promise<MobileApiResult<MobileCreateOfferResult>> {
  const parsed = createListingOfferBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Enter a valid offer" }

  const result = await createListingOffer(supabase, userId, listingId, parsed.data)
  if (!result.ok) {
    if (result.code === "offer_already_open" && result.offerId) {
      const mapped = mobileCreateOfferResultSchema.safeParse({
        offer_id: result.offerId,
        conversation_id: result.conversationId ?? null,
        already_open: true,
      })
      if (mapped.success) {
        revalidatePath("/dashboard/offers")
        return { ok: true, data: mapped.data }
      }
    }
    return { ok: false, status: result.status, error: result.error }
  }

  revalidatePath("/dashboard/offers")
  await captureServerEvent(userId, "offer_submitted", {
    listing_id: listingId,
    offer_id: result.offerId,
    amount: parsed.data.amount,
    fulfillment: parsed.data.fulfillment,
  })

  const mapped = mobileCreateOfferResultSchema.safeParse({
    offer_id: result.offerId,
    conversation_id: result.conversationId,
    already_open: false,
  })
  if (!mapped.success) return { ok: false, status: 500, error: "Could not send your offer" }
  return { ok: true, data: mapped.data }
}
