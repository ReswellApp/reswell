import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { buildLiveChatKlaviyoReplyPayload } from "@/lib/live-chat/klaviyo-reply"
import { shouldNotifyKlaviyoOnLiveChatReply } from "@/lib/live-chat/klaviyo-policy"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { openLiveChatSupportCase } from "@/lib/services/liveChatSupportCase"

/**
 * Fire the existing Klaviyo **Support Tickets Response** metric for a
 * customer-visible live-chat reply (Hayden / David auto-reply or staff desk).
 * Soft-open stays silent; this is the Intercom-style “you still get the answer”
 * email after they close the tab.
 */
export async function notifyLiveChatReplyViaKlaviyo(
  svc: SupabaseClient,
  args: {
    session: LiveChatSessionRow
    messageId: string
    content: string
  },
): Promise<void> {
  try {
    let email = args.session.visitor_email?.trim() || null
    if (!email && args.session.user_id) {
      email = await getAuthEmailForUserId(args.session.user_id)
    }
    if (!shouldNotifyKlaviyoOnLiveChatReply({ visitorEmail: email, content: args.content })) {
      return
    }

    let session = args.session
    if (email && !session.visitor_email) {
      session = { ...session, visitor_email: email }
    }

    let caseId = session.support_case_id
    if (!caseId) {
      const opened = await openLiveChatSupportCase(svc, session)
      if (opened) {
        session = {
          ...session,
          support_case_id: opened.supportCaseId,
          contact_message_id: opened.contactMessageId || session.contact_message_id,
        }
        caseId = opened.supportCaseId
      }
    }

    const payload = buildLiveChatKlaviyoReplyPayload({
      visitorEmail: email,
      supportCaseId: caseId,
      messageId: args.messageId,
      content: args.content,
      publicId: session.public_id,
      userId: session.user_id,
      origin: publicSiteOriginForEmail(),
    })
    if (!payload) return

    await trackKlaviyoSupportTicketResponse(payload)
  } catch (error) {
    console.error("[liveChatKlaviyoReply] Support Tickets Response failed:", error)
  }
}
