import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { userParticipatesInConversation, ensureConversationBetweenBuyerAndSeller } from "@/lib/db/conversations"
import {
  submitMessagesSupportTicketSchema,
  messagesSupportTopicLabels,
} from "@/lib/validations/messagesSupportTicket"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  formatSupportCaseWelcomeMessage,
  insertMemberMessageInConversation,
  insertSupportStaffThreadMessage,
} from "@/lib/services/supportTicketThreadNotifications"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { insertSupportCase, insertSupportCaseMessage } from "@/lib/db/supportCases"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

function topicToKind(topic: string): SupportCaseKind {
  switch (topic) {
    case "account":
      return "account"
    case "payments":
      return "payments"
    case "safety":
      return "safety"
    default:
      return "general"
  }
}

export async function submitMessagesSupportTicketService(
  raw: unknown,
): Promise<
  { success: true; id: string; support_conversation_id: string | null } | { error: string }
> {
  const parsed = submitMessagesSupportTicketSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg = first.details?.[0] ?? first.topic?.[0] ?? "Invalid input"
    return { error: msg }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to contact support from Messages." }
  }

  const email = (user.email ?? "").trim()
  if (!email) {
    return { error: "Your account needs an email address before you can open a ticket." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle()

  const name =
    (profile?.display_name ?? "").trim() ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
    "Reswell member"

  const relatedId = parsed.data.related_conversation_id?.trim() || null

  if (relatedId) {
    const ok = await userParticipatesInConversation(supabase, user.id, relatedId)
    if (!ok) {
      return { error: "That conversation could not be linked." }
    }
  }

  const subject = messagesSupportTopicLabels[parsed.data.topic]

  let supportConversationId: string | null = null
  const resolvedSupport = await resolveSupportRecipientUserId()
  if (resolvedSupport.ok && resolvedSupport.userId !== user.id) {
    const conv = await ensureConversationBetweenBuyerAndSeller(supabase, user.id, resolvedSupport.userId)
    if (conv) {
      supportConversationId = conv.id
    }
  }

  const { data: row, error } = await supabase
    .from("contact_messages")
    .insert({
      name,
      email,
      subject,
      message: parsed.data.details.trim(),
      source: "messages_support",
      user_id: user.id,
      related_conversation_id: relatedId,
      support_conversation_id: supportConversationId,
    })
    .select("id")
    .single()

  if (error || !row) {
    console.error("submitMessagesSupportTicketService", error)
    return { error: "Could not send your request. Try again in a moment." }
  }

  const ticketId = row.id as string

  if (supportConversationId) {
    const details = parsed.data.details.trim()
    const posted = await insertMemberMessageInConversation(supabase, {
      conversationId: supportConversationId,
      senderId: user.id,
      content: details,
    })
    if (!posted) {
      console.error("submitMessagesSupportTicketService: failed to post opening thread message")
    } else if (resolvedSupport.ok) {
      const welcome = await insertSupportStaffThreadMessage({
        conversationId: supportConversationId,
        supportUserId: resolvedSupport.userId,
        content: formatSupportCaseWelcomeMessage({
          topicLabel: subject,
          caseRef: formatSupportCaseReference(ticketId),
        }),
      })
      if (!welcome.ok) {
        console.error("submitMessagesSupportTicketService: welcome message insert failed")
      }
    }
  }

  const service = createServiceRoleClient()
  const kind = topicToKind(parsed.data.topic)
  const dual = await insertSupportCase(service, {
    kind,
    subject,
    preview: parsed.data.details.trim(),
    requester_user_id: user.id,
    requester_email: email,
    requester_role: "member",
    conversation_id: relatedId,
    contact_message_id: ticketId,
    source_channel: "help_hub",
    priority: kind === "safety" ? "urgent" : "normal",
  })
  if (dual.data) {
    await insertSupportCaseMessage(service, {
      case_id: dual.data.id,
      author_user_id: user.id,
      author_role: "customer",
      body: parsed.data.details.trim(),
    })
  }

  await trackKlaviyoSupportTicketCreated({
    supportTicketId: ticketId,
    email,
    externalId: user.id,
    source: "messages_support",
    subject,
    message: parsed.data.details.trim(),
  })

  return { success: true, id: ticketId, support_conversation_id: supportConversationId }
}
