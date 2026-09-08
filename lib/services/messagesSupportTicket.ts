import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import {
  submitMessagesSupportTicketSchema,
  messagesSupportTopicLabels,
} from "@/lib/validations/messagesSupportTicket"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import type { SupportCaseKind } from "@/lib/types/supportCase"

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
): Promise<{ success: true; id: string } | { error: string; existingId?: string }> {
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

  const openGate = await rejectIfMemberHasOpenSupportCase(user.id)
  if (!openGate.ok) {
    return { error: openGate.error, existingId: openGate.existingId }
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
  const details = parsed.data.details.trim()

  const { data: row, error } = await supabase
    .from("contact_messages")
    .insert({
      name,
      email,
      subject,
      message: details,
      source: "messages_support",
      user_id: user.id,
      related_conversation_id: relatedId,
    })
    .select("id")
    .single()

  if (error || !row) {
    console.error("submitMessagesSupportTicketService", error)
    return { error: "Could not send your request. Try again in a moment." }
  }

  const sidecarId = row.id as string
  const service = createServiceRoleClient()
  const kind = topicToKind(parsed.data.topic)
  const opened = await createSupportCaseWithOpeningMessage(service, {
    kind,
    subject,
    preview: details,
    requester_user_id: user.id,
    requester_email: email,
    requester_role: "member",
    conversation_id: relatedId,
    contact_message_id: sidecarId,
    source_channel: "help_hub",
    priority: kind === "safety" ? "urgent" : "normal",
    body: details,
    authorUserId: user.id,
  })

  const caseId = opened?.id ?? sidecarId
  await trackKlaviyoSupportTicketCreated({
    supportTicketId: caseId,
    email,
    externalId: user.id,
    source: "messages_support",
    subject,
    message: details,
  })

  return { success: true, id: caseId }
}
