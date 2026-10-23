import {
  mobileCheckoutAddressBodySchema,
  mobileCheckoutAddressesSchema,
  mobileCheckoutConfigSchema,
  mobileCheckoutFinalizeBodySchema,
  mobileCheckoutFinalizeSchema,
  mobileCheckoutPaymentBodySchema,
  mobileCheckoutPaymentSchema,
  mobileCheckoutQuoteBodySchema,
  mobileCheckoutQuoteSchema,
  type MobileCheckoutAddresses,
  type MobileCheckoutFinalize,
  type MobileCheckoutPayment,
  type MobileCheckoutQuote,
} from "@reswell/api-contract"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { quoteCheckoutShippingForUser } from "@/app/api/checkout/shipping-quote/route"
import { finalizeMarketplaceOrderForUser } from "@/app/api/stripe/finalize-order/route"
import { createPaymentIntentForUser } from "@/app/api/stripe/create-payment-intent/route"
import { fetchProfileAddresses, insertProfileAddress, profileAddressOneLine } from "@/lib/db/profile-addresses"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"
import { retrieveSucceededPaymentIntent } from "@/lib/stripe-complete-order"

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

async function readJson(response: NextResponse): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = (await response.json()) as unknown
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  return { status: response.status, body: record }
}

function errorMessage(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === "string" && body.error.trim() ? body.error : fallback
}

export function getMobileCheckoutConfigService(): MobileApiResult<{ publishable_key: string }> {
  const parsed = mobileCheckoutConfigSchema.safeParse({ publishable_key: stripePublishableKey() })
  if (!parsed.success) return { ok: false, status: 503, error: "Card payments are not configured" }
  return { ok: true, data: parsed.data }
}

export async function listMobileCheckoutAddressesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileCheckoutAddresses>> {
  const listed = await fetchProfileAddresses(supabase, userId)
  if (listed.error) return { ok: false, status: 500, error: "Unable to load addresses right now" }
  const parsed = mobileCheckoutAddressesSchema.safeParse({
    addresses: listed.addresses.map((address) => ({
      id: address.id,
      full_name: address.full_name,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone,
      is_default: address.is_default,
      label_line: profileAddressOneLine(address),
    })),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load addresses right now" }
  return { ok: true, data: parsed.data }
}

export async function saveMobileCheckoutAddressService(
  supabase: SupabaseClient,
  userId: string,
  body: unknown,
): Promise<MobileApiResult<MobileCheckoutAddresses>> {
  const parsed = mobileCheckoutAddressBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Enter a complete shipping address" }
  const existing = await fetchProfileAddresses(supabase, userId)
  const saved = await insertProfileAddress(
    supabase,
    userId,
    {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone?.trim() || null,
      line1: parsed.data.line1,
      line2: parsed.data.line2?.trim() || null,
      city: parsed.data.city,
      state: parsed.data.state?.trim() || null,
      postal_code: parsed.data.postal_code,
      country: parsed.data.country.toUpperCase(),
    },
    { isDefault: existing.addresses.length === 0 },
  )
  if (!saved.address) return { ok: false, status: 500, error: saved.error ?? "Unable to save that address" }
  return listMobileCheckoutAddressesService(supabase, userId)
}

export async function quoteMobileCheckoutService(
  supabase: SupabaseClient,
  user: User,
  body: unknown,
): Promise<MobileApiResult<MobileCheckoutQuote>> {
  const parsed = mobileCheckoutQuoteBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Choose an address to see shipping rates" }
  const response = await quoteCheckoutShippingForUser(supabase, user, {
    listing_ids: parsed.data.listing_ids,
    address_id: parsed.data.address_id,
    ...(parsed.data.service_code ? { selected_service_code: parsed.data.service_code } : {}),
  })
  const result = await readJson(response)
  if (result.status !== 200) {
    return { ok: false, status: result.status, error: errorMessage(result.body, "Unable to quote shipping right now") }
  }
  const data = result.body.data
  if (!data || typeof data !== "object") {
    return { ok: false, status: 500, error: "Unable to quote shipping right now" }
  }
  const quote = data as Record<string, unknown>
  const item = Number(quote.itemPrice)
  const shipping = Number(quote.shippingUsd)
  const total = Number(quote.totalUsd)
  const ratesRaw = Array.isArray(quote.availableShippingRates) ? quote.availableShippingRates : []
  const mapped = mobileCheckoutQuoteSchema.safeParse({
    item_usd: item,
    item_label: money(item),
    shipping_usd: shipping,
    shipping_label: money(shipping),
    total_usd: total,
    total_label: money(total),
    quote_token: typeof quote.quoteToken === "string" ? quote.quoteToken : null,
    rates: ratesRaw.flatMap((rate) => {
      if (!rate || typeof rate !== "object") return []
      const row = rate as Record<string, unknown>
      const amount = Number(row.totalAmount)
      if (typeof row.rateId !== "string" || !Number.isFinite(amount)) return []
      return [
        {
          rate_id: row.rateId,
          service_code: typeof row.serviceCode === "string" ? row.serviceCode : "",
          service_name: typeof row.serviceName === "string" ? row.serviceName : "Shipping",
          label: typeof row.displayName === "string" ? row.displayName : "Shipping",
          amount_usd: amount,
          amount_label: money(amount),
          delivery_days: typeof row.deliveryDays === "number" ? row.deliveryDays : null,
        },
      ]
    }),
  })
  if (!mapped.success) return { ok: false, status: 500, error: "Unable to quote shipping right now" }
  return { ok: true, data: mapped.data }
}

export async function payMobileCheckoutService(
  supabase: SupabaseClient,
  user: User,
  body: unknown,
): Promise<MobileApiResult<MobileCheckoutPayment>> {
  const parsed = mobileCheckoutPaymentBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Checkout is missing a listing" }
  if (parsed.data.fulfillment === "shipping" && !parsed.data.address_id) {
    return { ok: false, status: 400, error: "Choose a shipping address" }
  }
  const response = await createPaymentIntentForUser(supabase, user, {
    listing_ids: parsed.data.listing_ids,
    fulfillment: parsed.data.fulfillment,
    ...(parsed.data.address_id ? { address_id: parsed.data.address_id } : {}),
    ...(parsed.data.quote_token ? { quote_token: parsed.data.quote_token } : {}),
  })
  const result = await readJson(response)
  if (result.status !== 200) {
    return { ok: false, status: result.status, error: errorMessage(result.body, "Could not start payment") }
  }
  const total = Number(result.body.totalUsd)
  const shipping = Number(result.body.shippingUsd)
  const mapped = mobileCheckoutPaymentSchema.safeParse({
    client_secret: result.body.clientSecret,
    shipping_usd: Number.isFinite(shipping) ? shipping : 0,
    total_usd: Number.isFinite(total) ? total : 0,
    total_label: money(Number.isFinite(total) ? total : 0),
  })
  if (!mapped.success) return { ok: false, status: 500, error: "Could not start payment" }
  return { ok: true, data: mapped.data }
}

export async function finalizeMobileCheckoutService(
  supabase: SupabaseClient,
  user: User,
  body: unknown,
): Promise<MobileApiResult<MobileCheckoutFinalize>> {
  const parsed = mobileCheckoutFinalizeBodySchema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: "Missing payment" }
  const retrieved = await retrieveSucceededPaymentIntent(parsed.data.payment_intent_id)
  if (!retrieved.ok) return { ok: false, status: retrieved.status, error: retrieved.error }
  const response = await finalizeMarketplaceOrderForUser(supabase, user, retrieved.paymentIntent)
  const result = await readJson(response)
  if (result.status !== 200) {
    return { ok: false, status: result.status, error: errorMessage(result.body, "Could not complete this order") }
  }
  const mapped = mobileCheckoutFinalizeSchema.safeParse({ order_id: result.body.orderId })
  if (!mapped.success) return { ok: false, status: 500, error: "Could not complete this order" }
  return { ok: true, data: mapped.data }
}
