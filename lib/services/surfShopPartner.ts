import { insertContactFormMessage } from "@/lib/db/contactMessages"
import { FOR_SURF_SHOPS_OFFER_MONTHS } from "@/lib/for-surf-shops"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SurfShopPartnerApplicationInput } from "@/lib/validations/surfShopPartner"

export const SURF_SHOP_PARTNER_SUBJECT = "Surf shop partner offer"

function buildPartnerMessage(input: SurfShopPartnerApplicationInput): string {
  const lines = [
    `Surf shop partner application — ${FOR_SURF_SHOPS_OFFER_MONTHS} months no selling fees`,
    "",
    `Contact name: ${input.name}`,
    `Shop name: ${input.shopName}`,
    `Email: ${input.email}`,
    `City: ${input.city}`,
  ]

  if (input.website) {
    lines.push(`Website / Instagram: ${input.website}`)
  }
  if (input.boardCount) {
    lines.push(`Approx. boards to list: ${input.boardCount}`)
  }
  if (input.message) {
    lines.push("", "Note from the shop:", input.message)
  }

  lines.push(
    "",
    "Ops: confirm this is a real surf shop, then grant marketplace fee waiver (is_reswell_seller) for the offer window.",
  )

  return lines.join("\n")
}

export async function submitSurfShopPartnerApplicationService(
  input: SurfShopPartnerApplicationInput,
): Promise<{ success: true; ticketId?: string } | { error: string; existingId?: string }> {
  const message = buildPartnerMessage(input)
  const email = input.email
  const name = input.name

  let linkedUserId: string | null = null
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    if (user?.id && (user.email ?? "").trim().toLowerCase() === email.toLowerCase()) {
      linkedUserId = user.id
      const openGate = await rejectIfMemberHasOpenSupportCase(user.id)
      if (!openGate.ok) {
        return { error: openGate.error, existingId: openGate.existingId }
      }
    }
  } catch {
    // Anonymous submission — continue without linking.
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("submitSurfShopPartnerApplicationService: missing service role client", e)
    return { error: "Failed to send application" }
  }

  const inserted = await insertContactFormMessage(supabase, {
    name,
    email,
    message,
    subject: SURF_SHOP_PARTNER_SUBJECT,
    user_id: linkedUserId,
  })
  if ("error" in inserted) {
    console.error("Surf shop partner insert error:", inserted.error)
    return { error: "Failed to send application" }
  }

  const opened = await createSupportCaseWithOpeningMessage(supabase, {
    kind: "general",
    subject: SURF_SHOP_PARTNER_SUBJECT,
    preview: `${input.shopName} — ${input.city}`,
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
    subject: SURF_SHOP_PARTNER_SUBJECT,
    message,
  })

  return { success: true, ticketId: caseId }
}
