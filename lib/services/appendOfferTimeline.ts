import { randomUUID } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Appends one event to `offers.offer_timeline` via SECURITY DEFINER RPC (service role only).
 */
export async function appendOfferTimelineEntry(
  offerId: string,
  input: {
    senderId: string
    senderRole: "BUYER" | "SELLER"
    action: string
    amount: number | null
    note: string | null
    /** Preserve migrated `id` / `created_at` when repairing; omit for new events. */
    id?: string
    createdAt?: string
  },
): Promise<boolean> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[appendOfferTimelineEntry] service client:", e)
    return false
  }

  const entry = {
    id: input.id ?? randomUUID(),
    sender_id: input.senderId,
    sender_role: input.senderRole,
    action: input.action,
    amount: input.amount,
    note: input.note,
    created_at: input.createdAt ?? new Date().toISOString(),
  }

  const { error } = await service.rpc("append_offer_timeline", {
    p_offer_id: offerId,
    p_entry: entry as unknown as Record<string, unknown>,
  })

  if (error) {
    console.error("[appendOfferTimelineEntry] rpc:", error)
    return false
  }

  return true
}
