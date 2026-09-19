import { shouldNotifyKlaviyoOnLiveChatReply } from "./klaviyo-policy.ts"
import {
  liveChatVisitorResumeAbsoluteUrl,
  parseLiveChatResumePublicId,
} from "./resume-url.ts"

/** Payload for `trackKlaviyoSupportTicketResponse` — same metric, live-chat thread URL. */
export type LiveChatKlaviyoReplyPayload = {
  supportTicketId: string
  supportCaseId: string
  email: string
  externalId: string | null
  response: string
  responseType: "live_chat_reply"
  ticketUrl: string
  uniqueId: string
}

export function buildLiveChatKlaviyoReplyPayload(input: {
  visitorEmail: string | null | undefined
  supportCaseId: string | null | undefined
  messageId: string
  content: string
  publicId: string
  userId?: string | null
  origin: string
}): LiveChatKlaviyoReplyPayload | null {
  const email = input.visitorEmail?.trim() ?? ""
  const content = input.content.trim()
  const supportCaseId = input.supportCaseId?.trim() ?? ""
  const messageId = input.messageId.trim()
  const publicId = parseLiveChatResumePublicId(input.publicId)

  if (!shouldNotifyKlaviyoOnLiveChatReply({ visitorEmail: email, content })) {
    return null
  }
  if (!supportCaseId || !messageId || !publicId) return null

  return {
    supportTicketId: supportCaseId,
    supportCaseId,
    email,
    externalId: input.userId?.trim() || null,
    response: content,
    responseType: "live_chat_reply",
    ticketUrl: liveChatVisitorResumeAbsoluteUrl(input.origin, publicId),
    uniqueId: `live-chat-reply-${messageId}`,
  }
}
