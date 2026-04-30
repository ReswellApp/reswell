import { createClient } from "@/lib/supabase/server"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import {
  submitMessagesSupportTicketSchema,
  messagesSupportTopicLabels,
} from "@/lib/validations/messagesSupportTicket"

export async function submitMessagesSupportTicketService(
  raw: unknown,
): Promise<{ success: true; id: string } | { error: string }> {
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
    })
    .select("id")
    .single()

  if (error || !row) {
    console.error("submitMessagesSupportTicketService", error)
    return { error: "Could not send your request. Try again in a moment." }
  }

  return { success: true, id: row.id as string }
}
