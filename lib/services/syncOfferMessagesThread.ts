import { createServiceRoleClient } from "@/lib/supabase/server"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { formatOfferThreadContent } from "@/lib/utils/format-offer-thread-content"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parseAmount(a: unknown): number {
  const n = typeof a === "number" ? a : parseFloat(String(a ?? "0"))
  return roundMoney(Number.isFinite(n) ? n : 0)
}

export type SyncOfferThreadResult =
  | { ok: true; conversationId: string; didInsert: boolean }
  | { ok: false; reason: "offer_not_found" | "not_pending" | "sync_failed" }

/**
 * Backfills the main `messages` thread from `offers` / `offer_messages` when missing
 * (e.g. offers created before mirroring existed, or a failed insert). Uses the service
 * role so either buyer or seller can trigger repair via an authenticated API route.
 */
export async function syncOfferThreadIfMissing(offerId: string): Promise<SyncOfferThreadResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[syncOfferThreadIfMissing] service client:", e)
    return { ok: false, reason: "sync_failed" }
  }

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, seller_id, status, initial_amount, current_amount")
    .eq("id", offerId)
    .maybeSingle()

  if (offerErr || !offer) {
    return { ok: false, reason: "offer_not_found" }
  }

  if (offer.status !== "PENDING") {
    return { ok: false, reason: "not_pending" }
  }

  const { data: omRows, error: omErr } = await supabase
    .from("offer_messages")
    .select("amount, note, action, created_at")
    .eq("offer_id", offerId)
    .eq("action", "OFFER")
    .order("created_at", { ascending: true })
    .limit(1)

  if (omErr) {
    console.error("[syncOfferThreadIfMissing] offer_messages:", omErr)
    return { ok: false, reason: "sync_failed" }
  }

  const first = omRows?.[0]
  const amount =
    first?.amount != null
      ? parseAmount(first.amount)
      : parseAmount(offer.initial_amount ?? offer.current_amount)

  const noteRaw = first?.note
  const note =
    typeof noteRaw === "string" && noteRaw.trim() !== "" ? noteRaw.trim() : null

  const threadContent = formatOfferThreadContent(amount, note)

  const result = await appendConversationMessageWithClient(
    supabase,
    {
      buyerId: offer.buyer_id as string,
      sellerId: offer.seller_id as string,
      listingId: offer.listing_id as string,
      senderId: offer.buyer_id as string,
      content: threadContent,
      offerId: offerId,
    },
  )

  if (!result.ok) {
    return { ok: false, reason: "sync_failed" }
  }

  return {
    ok: true,
    conversationId: result.conversationId,
    didInsert: result.inserted,
  }
}

/**
 * Pending offers where the user is buyer or seller — used to repair Chats in bulk.
 */
export async function listPendingOfferIdsForUser(userId: string): Promise<string[]> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return []
  }

  const { data, error } = await supabase
    .from("offers")
    .select("id")
    .eq("status", "PENDING")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

  if (error || !data?.length) {
    if (error) console.error("[listPendingOfferIdsForUser]", error)
    return []
  }

  return data.map((r) => r.id as string)
}

export async function syncAllPendingOfferThreadsForUser(userId: string): Promise<{
  examined: number
  inserted: number
  failed: number
}> {
  const ids = await listPendingOfferIdsForUser(userId)
  let inserted = 0
  let failed = 0
  for (const id of ids) {
    const r = await syncOfferThreadIfMissing(id)
    if (r.ok) {
      if (r.didInsert) inserted += 1
    } else {
      failed += 1
    }
  }
  return { examined: ids.length, inserted, failed }
}
