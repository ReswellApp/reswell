/**
 * Server-only: Klaviyo Events API — fires when a marketplace message is sent.
 *
 * Sender email + display name: prefer `sessionSender` from server actions (session + profiles
 * read as the logged-in user) so production works without SUPABASE_SERVICE_ROLE_KEY for those fields.
 *
 * Receiver email: uses auth.admin.getUserById (requires SUPABASE_SERVICE_ROLE_KEY in prod for email).
 * The Klaviyo **profile** on the event is the **receiver** so flows email them by default.
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

async function getReceiverEmail(receiverId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return null
  }
  try {
    const admin = createServiceRoleClient()
    const r = await admin.auth.admin.getUserById(receiverId)
    return r.data.user?.email?.trim() || null
  } catch {
    return null
  }
}

/** Public-facing sender label: shop name for shops, else display_name (matches listing UI). */
function displayNameFromProfileRow(
  data: {
    display_name?: string | null
    shop_name?: string | null
    is_shop?: boolean | null
  } | null,
): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Anonymous Seller"
}

/** Uses service role + profiles table (e.g. purchase notification — no user session). */
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

    return displayNameFromProfileRow(data)
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
  /**
   * From `createClient()` + `getUser()` + own `profiles` row — works in production without
   * service role for sender fields.
   */
  sessionSender?: {
    email: string | null
    profile: {
      display_name?: string | null
      shop_name?: string | null
      is_shop?: boolean | null
    } | null
  }
}

/**
 * Metric name shown in Klaviyo as "Message Sent".
 *
 * **Profile = receiver** so metric-triggered flows default to emailing the person who was
 * messaged (not the sender). Sender details stay on the event as properties for the template.
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
    sessionSender,
  } = payload

  let senderEmail: string | null
  let senderDisplayName: string
  let receiverEmail: string | null

  if (sessionSender) {
    senderEmail = sessionSender.email?.trim() || null
    senderDisplayName = displayNameFromProfileRow(sessionSender.profile)
    receiverEmail = await getReceiverEmail(receiverUserId)
  } else {
    const [emails, displayFromSr] = await Promise.all([
      getAuthEmailsForUsers(senderUserId, receiverUserId),
      getSenderPublicDisplayName(senderUserId),
    ])
    senderEmail = emails.a
    receiverEmail = emails.b
    senderDisplayName = displayFromSr
  }

  const trimmed =
    message.length > MESSAGE_PROP_MAX
      ? `${message.slice(0, MESSAGE_PROP_MAX)}…`
      : message

  await sendKlaviyoServerEvent({
    metricName: "Message Sent",
    profile: {
      external_id: receiverUserId,
      email: receiverEmail,
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
