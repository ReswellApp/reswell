import { insertContactFormMessage } from "@/lib/db/contactMessages"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  SURF_SHOP_PARTNER_SUBJECT,
  buildSurfShopPartnerCustomerMessage,
  buildSurfShopPartnerOpsNotes,
  surfShopPartnerLinkedUserId,
} from "@/lib/utils/surf-shop-partner-ticket"
import type { SurfShopPartnerApplicationInput } from "@/lib/validations/surfShopPartner"

export async function submitSurfShopPartnerApplicationService(
  input: SurfShopPartnerApplicationInput,
): Promise<{ success: true; ticketId?: string } | { error: string; existingId?: string }> {
  const customerMessage = buildSurfShopPartnerCustomerMessage(input)
  const email = input.email
  const name = input.name

  let linkedUserId: string | null = null
  let sessionEmail: string | null = null
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    linkedUserId = surfShopPartnerLinkedUserId(user)
    sessionEmail = (user?.email ?? "").trim() || null
    if (linkedUserId) {
      const openGate = await rejectIfMemberHasOpenSupportCase(linkedUserId)
      if (!openGate.ok) {
        return { error: openGate.error, existingId: openGate.existingId }
      }
    }
  } catch {
    // Anonymous submission — continue without linking.
  }

  const opsNotes = buildSurfShopPartnerOpsNotes({
    sessionEmail,
    workEmail: email,
  })

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
    message: customerMessage,
    subject: SURF_SHOP_PARTNER_SUBJECT,
    user_id: linkedUserId,
    internal_notes: opsNotes,
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
    body: customerMessage,
    authorUserId: linkedUserId,
    internal_notes: opsNotes,
  })

  const caseId = opened?.id ?? inserted.id
  await trackKlaviyoSupportTicketCreated({
    supportTicketId: caseId,
    email,
    externalId: linkedUserId,
    source: "contact_form",
    subject: SURF_SHOP_PARTNER_SUBJECT,
    message: customerMessage,
  })

  return { success: true, ticketId: caseId }
}
