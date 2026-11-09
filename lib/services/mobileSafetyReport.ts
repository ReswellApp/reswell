import type { SupabaseClient, User } from "@supabase/supabase-js"
import { userParticipatesInConversation } from "@/lib/db/conversations"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { rejectIfMemberHasOpenSupportCase } from "@/lib/services/supportCaseOpenLimit"
import { blockUserService } from "@/lib/services/userBlocks"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"

export type MobileListingReportInput = {
  reason: string
  details?: string
}

export type MobileUserReportInput = {
  reported_user_id: string
  reason: string
  details?: string
  conversation_id?: string
  block?: boolean
}

async function openSafetyCase(args: {
  user: User
  subject: string
  body: string
  listingId?: string | null
  conversationId?: string | null
}): Promise<MobileApiResult<{ id: string }>> {
  const openGate = await rejectIfMemberHasOpenSupportCase(args.user.id)
  if (!openGate.ok) {
    return { ok: false, status: 409, error: openGate.error }
  }

  const email = (args.user.email ?? "").trim()
  if (!email) {
    return {
      ok: false,
      status: 400,
      error: "Your account needs an email address before you can report something.",
    }
  }

  const service = createServiceRoleClient()
  const opened = await createSupportCaseWithOpeningMessage(service, {
    kind: "safety",
    subject: args.subject,
    preview: args.body.slice(0, 180),
    body: args.body,
    requester_user_id: args.user.id,
    requester_email: email,
    requester_role: "member",
    listing_id: args.listingId ?? null,
    conversation_id: args.conversationId ?? null,
    source_channel: "mobile",
    opened_by: "requester",
    priority: "urgent",
    authorUserId: args.user.id,
  })
  if (!opened) return { ok: false, status: 500, error: "Couldn't send that report right now." }

  try {
    await trackKlaviyoSupportTicketCreated({
      supportTicketId: opened.id,
      email,
      externalId: args.user.id,
      source: "messages_support",
      subject: args.subject,
    })
  } catch (error) {
    console.warn("[mobileSafetyReport] klaviyo skipped", error)
  }

  return { ok: true, data: { id: opened.id } }
}

export async function reportListingService(
  supabase: SupabaseClient,
  user: User,
  listingId: string,
  input: MobileListingReportInput,
): Promise<MobileApiResult<{ id: string }>> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, user_id")
    .eq("id", listingId)
    .maybeSingle()
  if (error || !listing) return { ok: false, status: 404, error: "Listing not found." }
  if (listing.user_id === user.id) {
    return { ok: false, status: 400, error: "You can't report your own listing." }
  }

  const reason = input.reason.trim()
  const details = (input.details ?? "").trim()
  const title = (listing.title ?? "Listing").trim() || "Listing"
  const body = [
    `Report type: listing`,
    `Listing id: ${listing.id}`,
    `Listing title: ${title}`,
    `Seller id: ${listing.user_id}`,
    `Reason: ${reason}`,
    details ? `Details: ${details}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  return openSafetyCase({
    user,
    subject: `Listing report: ${title}`.slice(0, 120),
    body,
    listingId: listing.id,
  })
}

export async function reportUserService(
  supabase: SupabaseClient,
  user: User,
  input: MobileUserReportInput,
): Promise<MobileApiResult<{ id: string; blocked: boolean }>> {
  const reportedId = input.reported_user_id.trim()
  if (!reportedId) return { ok: false, status: 400, error: "Missing member." }
  if (reportedId === user.id) {
    return { ok: false, status: 400, error: "You can't report yourself." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", reportedId)
    .maybeSingle()
  if (!profile) return { ok: false, status: 404, error: "Member not found." }

  const conversationId = input.conversation_id?.trim() || null
  if (conversationId) {
    const ok = await userParticipatesInConversation(supabase, user.id, conversationId)
    if (!ok) return { ok: false, status: 400, error: "That conversation could not be linked." }
  }

  const reason = input.reason.trim()
  const details = (input.details ?? "").trim()
  const name = (profile.display_name ?? "Member").trim() || "Member"
  const body = [
    `Report type: member`,
    `Reported user id: ${reportedId}`,
    `Reported name: ${name}`,
    conversationId ? `Conversation id: ${conversationId}` : null,
    `Reason: ${reason}`,
    details ? `Details: ${details}` : null,
    input.block ? `Also blocked by reporter: yes` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const opened = await openSafetyCase({
    user,
    subject: `Member report: ${name}`.slice(0, 120),
    body,
    conversationId,
  })
  if (!opened.ok) return opened

  let blocked = false
  if (input.block) {
    const blockResult = await blockUserService(supabase, user, reportedId)
    blocked = blockResult.ok
  }

  return { ok: true, data: { id: opened.data.id, blocked } }
}
