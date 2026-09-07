import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { findMessagesSupportTicketMetaByConversationId } from "@/lib/db/contactMessages"
import { findOrderSupportMetaByConversationId } from "@/lib/db/order-support"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import { isSupportInboxConversation } from "@/lib/utils/messages-inbox-grouping"
import { adminSupportCaseHref, supportCaseResponseHref } from "@/lib/utils/support-case-paths"

async function currentUserIsStaff(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  return Boolean(profile && (profile.is_admin === true || profile.is_employee === true))
}

/**
 * Support DMs do not live in marketplace `/messages`. Deep links go to the
 * case thread (member) or the admin case desk (staff).
 */
export async function resolveSupportRedirectForConversation(
  conversationId: string,
): Promise<string | null> {
  const supportResolved = await resolveSupportRecipientUserId()
  if (!supportResolved.ok) return null

  const supabase = createServiceRoleClient()
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !conv) return null

  const [contactTicket, orderCase] = await Promise.all([
    findMessagesSupportTicketMetaByConversationId(supabase, conversationId),
    findOrderSupportMetaByConversationId(supabase, conversationId),
  ])

  const caseId = orderCase?.id ?? contactTicket?.id ?? null
  const staff = await currentUserIsStaff()

  if (caseId) {
    return staff ? adminSupportCaseHref(caseId) : supportCaseResponseHref(caseId)
  }

  const isSupportOrientation = isSupportInboxConversation(
    {
      listing_id: (conv.listing_id as string | null) ?? null,
      buyer_id: conv.buyer_id as string,
      seller_id: conv.seller_id as string,
    },
    supportResolved.userId,
  )

  if (!isSupportOrientation) return null

  return staff ? "/admin/contact-messages" : "/dashboard/support"
}
