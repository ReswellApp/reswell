import { insertContactFormMessage } from "@/lib/db/contactMessages"
import { FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS } from "@/lib/for-surfboard-flippers"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SurfboardFlipperOfferInput } from "@/lib/validations/surfboardFlipperOffer"

export const SURFBOARD_FLIPPER_OFFER_SUBJECT = "Surfboard flipper offer"

function buildFlipperMessage(input: SurfboardFlipperOfferInput): string {
  return [
    `Surfboard flipper application — ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months no selling fees`,
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `City: ${input.city}`,
    "",
    "Ops: confirm this person buys/sells boards, then grant marketplace fee waiver (is_reswell_seller) for the offer window.",
  ].join("\n")
}

export async function submitSurfboardFlipperOfferService(
  input: SurfboardFlipperOfferInput,
): Promise<{ success: true; ticketId?: string } | { error: string; existingId?: string }> {
  const message = buildFlipperMessage(input)
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
    console.error("submitSurfboardFlipperOfferService: missing service role client", e)
    return { error: "Failed to send application" }
  }

  const inserted = await insertContactFormMessage(supabase, {
    name,
    email,
    message,
    subject: SURFBOARD_FLIPPER_OFFER_SUBJECT,
    user_id: linkedUserId,
  })
  if ("error" in inserted) {
    console.error("Surfboard flipper offer insert error:", inserted.error)
    return { error: "Failed to send application" }
  }

  const opened = await createSupportCaseWithOpeningMessage(supabase, {
    kind: "general",
    subject: SURFBOARD_FLIPPER_OFFER_SUBJECT,
    preview: `${input.name} — ${input.city}`,
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
    subject: SURFBOARD_FLIPPER_OFFER_SUBJECT,
    message,
  })

  return { success: true, ticketId: caseId }
}
