/**
 * Server-only: Klaviyo Events API — fires when a marketplace message is sent.
 * Uses service role to resolve auth emails for flow triggers (requires SUPABASE_SERVICE_ROLE_KEY).
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const MESSAGE_PROP_MAX = 4000

async function getAuthEmailsForUsers(
  aId: string,
  bId: string,
): Promise<{ a: string | null; b: string | null }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { a: null, b: null }
  }
  try {
    const admin = createServiceRoleClient()
    const [ra, rb] = await Promise.all([
      admin.auth.admin.getUserById(aId),
      admin.auth.admin.getUserById(bId),
    ])
    return {
      a: ra.data.user?.email?.trim() || null,
      b: rb.data.user?.email?.trim() || null,
    }
  } catch {
    return { a: null, b: null }
  }
}

/** Public-facing sender label: shop name for shops, else display_name (matches listing UI). */
async function getSenderPublicDisplayName(senderId: string): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return ""
  }
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", senderId)
      .maybeSingle()

    if (!data) return ""
    const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
    if (data.is_shop && shop) return shop
    const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
    return dn || "Anonymous Seller"
  } catch {
    return ""
  }
}

export type KlaviyoMessageSentPayload = {
  senderUserId: string
  receiverUserId: string
  message: string
  conversationId: string
  listingId?: string | null
  messageId: string
  sentAt: string
}

/**
 * Metric name shown in Klaviyo as "Message Sent".
 * Profile = sender (the user who performed the action).
 */
export async function trackKlaviyoMessageSent(
  payload: KlaviyoMessageSentPayload,
): Promise<void> {
  const {
    senderUserId,
    receiverUserId,
    message,
    conversationId,
    listingId,
    messageId,
    sentAt,
  } = payload

  const [emails, senderDisplayName] = await Promise.all([
    getAuthEmailsForUsers(senderUserId, receiverUserId),
    getSenderPublicDisplayName(senderUserId),
  ])
  const senderEmail = emails.a
  const receiverEmail = emails.b

  const trimmed =
    message.length > MESSAGE_PROP_MAX
      ? `${message.slice(0, MESSAGE_PROP_MAX)}…`
      : message

  await sendKlaviyoServerEvent({
    metricName: "Message Sent",
    profile: {
      external_id: senderUserId,
      email: senderEmail,
    },
    properties: {
      sender_email: senderEmail ?? "",
      receiver_email: receiverEmail ?? "",
      sender_display_name: senderDisplayName,
      message: trimmed,
      time: sentAt,
      conversation_id: conversationId,
      listing_id: listingId ?? null,
      message_id: messageId,
      sender_user_id: senderUserId,
      receiver_user_id: receiverUserId,
    },
    uniqueId: `message-sent-${messageId}`,
  })
}
