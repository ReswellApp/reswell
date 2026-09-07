import { insertContactFormMessage } from "@/lib/db/contactMessages"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export async function submitContactFormMessageService(input: {
  name: string
  email: string
  message: string
}): Promise<{ success: true; ticketId?: string } | { error: string }> {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const message = typeof input.message === "string" ? input.message.trim() : ""

  if (!name || !email || !message) {
    return { error: "Name, email, and message are required" }
  }

  if (message.length > 10000) {
    return { error: "Message is too long" }
  }

  let linkedUserId: string | null = null
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    if (user?.id && (user.email ?? "").trim().toLowerCase() === email.toLowerCase()) {
      linkedUserId = user.id
    }
  } catch {
    // Anonymous submission — continue without linking.
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("submitContactFormMessageService: missing service role client", e)
    return { error: "Failed to send message" }
  }

  const inserted = await insertContactFormMessage(supabase, {
    name,
    email,
    message,
    user_id: linkedUserId,
  })
  if ("error" in inserted) {
    console.error("Contact form insert error:", inserted.error)
    return { error: "Failed to send message" }
  }

  const opened = await createSupportCaseWithOpeningMessage(supabase, {
    kind: "general",
    subject: "Website contact",
    preview: message,
    requester_user_id: linkedUserId,
    requester_email: email,
    requester_role: linkedUserId ? "member" : "guest",
    contact_message_id: inserted.id,
    source_channel: "contact_form",
    body: message,
    authorUserId: linkedUserId,
  })

  const caseId = opened?.id ?? inserted.id
  await trackKlaviyoSupportTicketCreated({
    supportTicketId: caseId,
    email,
    externalId: linkedUserId,
    source: "contact_form",
    subject: "Website contact",
    message,
  })

  return { success: true, ticketId: caseId }
}
