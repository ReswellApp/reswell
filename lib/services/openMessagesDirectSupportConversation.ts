import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { z } from "zod"

const uuidSchema = z.string().uuid()

function normalizeSupportEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

async function resolveSupportRecipientUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const byIdRaw = process.env.MESSAGES_DIRECT_SUPPORT_USER_ID?.trim()
  if (byIdRaw) {
    const parsed = uuidSchema.safeParse(byIdRaw)
    if (!parsed.success) {
      return { ok: false, error: "Support chat isn’t configured correctly. Please submit a ticket instead." }
    }
    return { ok: true, userId: parsed.data }
  }

  const byEmailRaw = process.env.MESSAGES_DIRECT_SUPPORT_EMAIL?.trim()
  if (!byEmailRaw) {
    return {
      ok: false,
      error: "Live chat routing isn’t set up yet. Choose a topic and send us a note below—we’ll reply by email.",
    }
  }

  const email = normalizeSupportEmail(byEmailRaw)
  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: "Support chat isn’t configured correctly. Please submit a ticket instead." }
  }

  try {
    const svc = createServiceRoleClient()
    const { data, error } = await svc.from("profiles").select("id").eq("email", email).maybeSingle()

    if (error || !data?.id) {
      return {
        ok: false,
        error:
          "We couldn’t route you to chat just now. Submit a ticket with the form and our team will help you there.",
      }
    }

    return { ok: true, userId: data.id }
  } catch {
    return { ok: false, error: "Live chat routing isn’t available. Please submit a ticket instead." }
  }
}

/**
 * Ensures an in-app DM thread exists between the current user (buyer) and the
 * configured support teammate (seller). Mirrors listing-initiated marketplace threads.
 */
export async function openMessagesDirectSupportConversationService(): Promise<
  { success: true; conversation_id: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const resolved = await resolveSupportRecipientUserId()
  if (!resolved.ok) {
    return { error: resolved.error }
  }

  const supportUserId = resolved.userId
  if (supportUserId === user.id) {
    return {
      error:
        "You’re signed in as the configured support user, so you can’t DM yourself. Test with another account, or set MESSAGES_DIRECT_SUPPORT_USER_ID / MESSAGES_DIRECT_SUPPORT_EMAIL to a dedicated inbox.",
    }
  }

  const existing = await getConversationForBuyerSeller(supabase, user.id, supportUserId)
  if (existing) {
    return { success: true, conversation_id: existing.id }
  }

  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({
      buyer_id: user.id,
      seller_id: supportUserId,
      listing_id: null,
    })
    .select("id")
    .single()

  if (convError || !newConv) {
    return { error: "Couldn’t open chat. Try again in a moment, or send a ticket instead." }
  }

  return { success: true, conversation_id: newConv.id }
}
