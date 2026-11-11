import type { SupabaseClient } from "@supabase/supabase-js"

export const CHECKOUT_SESSION_OPEN = "open"
export const CHECKOUT_SESSION_PAID = "paid"

export type CheckoutSessionRow = {
  id: string
  buyer_id: string
  fingerprint: string
  listing_ids: string[]
  listing_qtys: Record<string, number>
  amount_cents: number
  fulfillment: string
  address_id: string | null
  promo_code_id: string | null
  stripe_payment_intent_id: string | null
  order_id: string | null
  status: string
  expires_at: string
}

export function isMissingCheckoutSessionsRelation(error: {
  code?: string
  message?: string
} | null): boolean {
  if (!error) return false
  const message = (error.message ?? "").toLowerCase()
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("checkout_sessions") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  )
}

export async function dbListExpirableOpenCheckoutSessions(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; stripe_payment_intent_id: string | null }>> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select("id, stripe_payment_intent_id")
    .eq("status", CHECKOUT_SESSION_OPEN)
    .lt("expires_at", new Date().toISOString())
    .limit(50)

  if (error) {
    if (!isMissingCheckoutSessionsRelation(error)) {
      console.warn("[checkout-session] list expirable:", error.message)
    }
    return []
  }
  return (data ?? []) as Array<{ id: string; stripe_payment_intent_id: string | null }>
}

export async function dbListOpenCheckoutSessionsForBuyer(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<Array<{ id: string; listing_ids: string[]; stripe_payment_intent_id: string | null }>> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select("id, listing_ids, stripe_payment_intent_id")
    .eq("buyer_id", buyerId)
    .eq("status", CHECKOUT_SESSION_OPEN)
    .limit(40)

  if (error) {
    if (!isMissingCheckoutSessionsRelation(error)) {
      console.warn("[checkout-session] list open for buyer:", error.message)
    }
    return []
  }
  return (data ?? []) as Array<{
    id: string
    listing_ids: string[]
    stripe_payment_intent_id: string | null
  }>
}

export async function dbExpireStaleCheckoutSessions(
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.rpc("expire_stale_checkout_sessions")
  if (error && !isMissingCheckoutSessionsRelation(error)) {
    console.warn("[checkout-session] expire stale:", error.message)
  }
}

export async function dbFindOpenCheckoutSession(
  supabase: SupabaseClient,
  buyerId: string,
  fingerprint: string,
): Promise<{ session: CheckoutSessionRow | null; missingTable: boolean }> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select(
      "id, buyer_id, fingerprint, listing_ids, listing_qtys, amount_cents, fulfillment, address_id, promo_code_id, stripe_payment_intent_id, order_id, status, expires_at",
    )
    .eq("buyer_id", buyerId)
    .eq("fingerprint", fingerprint)
    .eq("status", CHECKOUT_SESSION_OPEN)
    .maybeSingle()

  if (error) {
    if (isMissingCheckoutSessionsRelation(error)) {
      return { session: null, missingTable: true }
    }
    console.error("[checkout-session] find open:", error.message)
    return { session: null, missingTable: false }
  }
  return { session: (data as CheckoutSessionRow | null) ?? null, missingTable: false }
}

export async function dbFindCheckoutSessionById(
  supabase: SupabaseClient,
  sessionId: string,
  buyerId: string,
): Promise<CheckoutSessionRow | null> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select(
      "id, buyer_id, fingerprint, listing_ids, listing_qtys, amount_cents, fulfillment, address_id, promo_code_id, stripe_payment_intent_id, order_id, status, expires_at",
    )
    .eq("id", sessionId)
    .eq("buyer_id", buyerId)
    .maybeSingle()

  if (error) {
    if (!isMissingCheckoutSessionsRelation(error)) {
      console.error("[checkout-session] find by id:", error.message)
    }
    return null
  }
  return (data as CheckoutSessionRow | null) ?? null
}

export async function dbFindRecentPaidCheckoutSession(
  supabase: SupabaseClient,
  buyerId: string,
  fingerprint: string,
): Promise<CheckoutSessionRow | null> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select(
      "id, buyer_id, fingerprint, listing_ids, listing_qtys, amount_cents, fulfillment, address_id, promo_code_id, stripe_payment_intent_id, order_id, status, expires_at",
    )
    .eq("buyer_id", buyerId)
    .eq("fingerprint", fingerprint)
    .eq("status", CHECKOUT_SESSION_PAID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (!isMissingCheckoutSessionsRelation(error)) {
      console.error("[checkout-session] find paid:", error.message)
    }
    return null
  }
  return (data as CheckoutSessionRow | null) ?? null
}

export async function dbInsertCheckoutSession(
  supabase: SupabaseClient,
  input: {
    buyerId: string
    fingerprint: string
    listingIds: string[]
    quantities: Record<string, number>
    amountCents: number
    fulfillment: string
    addressId: string | null
    promoCodeId: string | null
    expiresAtIso: string
  },
): Promise<{ session: CheckoutSessionRow | null; missingTable: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("checkout_sessions")
    .insert({
      buyer_id: input.buyerId,
      fingerprint: input.fingerprint,
      listing_ids: input.listingIds,
      listing_qtys: input.quantities,
      amount_cents: input.amountCents,
      fulfillment: input.fulfillment,
      address_id: input.addressId,
      promo_code_id: input.promoCodeId,
      status: CHECKOUT_SESSION_OPEN,
      expires_at: input.expiresAtIso,
    })
    .select(
      "id, buyer_id, fingerprint, listing_ids, listing_qtys, amount_cents, fulfillment, address_id, promo_code_id, stripe_payment_intent_id, order_id, status, expires_at",
    )
    .single()

  if (error) {
    if (isMissingCheckoutSessionsRelation(error)) {
      return { session: null, missingTable: true }
    }
    return { session: null, missingTable: false, error: error.message }
  }
  return { session: data as CheckoutSessionRow, missingTable: false }
}

export async function dbReplaceCheckoutSessionItems(
  supabase: SupabaseClient,
  sessionId: string,
  items: Array<{ listingId: string; quantity: number; uniqueItem: boolean }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: delError } = await supabase
    .from("checkout_session_items")
    .delete()
    .eq("session_id", sessionId)
  if (delError) return { ok: false, error: delError.message }

  if (items.length === 0) return { ok: true }

  const { error } = await supabase.from("checkout_session_items").insert(
    items.map((item) => ({
      session_id: sessionId,
      listing_id: item.listingId,
      quantity: item.quantity,
      unique_item: item.uniqueItem,
    })),
  )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function dbUpdateCheckoutSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Partial<{
    amount_cents: number
    stripe_payment_intent_id: string | null
    order_id: string | null
    status: string
    expires_at: string
    address_id: string | null
    fulfillment: string
    promo_code_id: string | null
  }>,
): Promise<void> {
  const { error } = await supabase
    .from("checkout_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
  if (error && !isMissingCheckoutSessionsRelation(error)) {
    console.error("[checkout-session] update:", error.message)
  }
}

export async function dbReserveCheckoutSessionStock(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { error } = await supabase.rpc("reserve_checkout_session_stock", {
    p_session_id: sessionId,
  })
  if (!error) return { ok: true }
  const message = error.message ?? "Could not reserve inventory"
  const insufficient =
    message.includes("insufficient stock") || message.includes("already reserved")
  return {
    ok: false,
    error: insufficient ? "This item is no longer available" : message,
    code: error.code,
  }
}

export async function dbCaptureCheckoutSessionStock(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("capture_checkout_session_stock", {
    p_session_id: sessionId,
  })
  if (!error) return { ok: true }
  if (isMissingCheckoutSessionsRelation(error)) return { ok: true }
  return { ok: false, error: error.message }
}

export async function dbMarkCheckoutSessionPaid(
  supabase: SupabaseClient,
  paymentIntentId: string,
  orderId: string,
  sessionId?: string | null,
): Promise<void> {
  const patch = {
    status: CHECKOUT_SESSION_PAID,
    order_id: orderId,
    updated_at: new Date().toISOString(),
  }
  if (sessionId?.trim()) {
    const { error } = await supabase
      .from("checkout_sessions")
      .update(patch)
      .eq("id", sessionId.trim())
    if (error && !isMissingCheckoutSessionsRelation(error)) {
      console.error("[checkout-session] mark paid by id:", error.message)
    }
    return
  }
  const { error } = await supabase
    .from("checkout_sessions")
    .update(patch)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", CHECKOUT_SESSION_OPEN)
  if (error && !isMissingCheckoutSessionsRelation(error)) {
    console.error("[checkout-session] mark paid:", error.message)
  }
}

export async function dbExpireOpenCheckoutSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  await supabase.rpc("release_checkout_session_stock", { p_session_id: sessionId })
  await dbUpdateCheckoutSession(supabase, sessionId, { status: "expired" })
}
