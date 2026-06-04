import { insertContactFormMessage } from "@/lib/db/contactMessages"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function submitContactFormMessageService(input: {
  name: string
  email: string
  message: string
}): Promise<{ success: true } | { error: string }> {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const message = typeof input.message === "string" ? input.message.trim() : ""

  if (!name || !email || !message) {
    return { error: "Name, email, and message are required" }
  }

  if (message.length > 10000) {
    return { error: "Message is too long" }
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("submitContactFormMessageService: missing service role client", e)
    return { error: "Failed to send message" }
  }

  const inserted = await insertContactFormMessage(supabase, { name, email, message })
  if ("error" in inserted) {
    console.error("Contact form insert error:", inserted.error)
    return { error: "Failed to send message" }
  }

  await trackKlaviyoSupportTicketCreated({
    supportTicketId: inserted.id,
    email,
    source: "contact_form",
    subject: "Website contact",
  })

  return { success: true }
}
