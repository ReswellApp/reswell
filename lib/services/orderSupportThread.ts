import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderSupportRequestById, type OrderSupportRequestRow } from "@/lib/db/order-support"
import { ensureCaseForOrderSupport } from "@/lib/services/supportCaseBackfill"
import {
  sendSupportCaseAdminReplyService,
  sendSupportCaseMemberReplyForSession,
} from "@/lib/services/supportCaseThread"

const replySchema = z.object({
  case_id: z.string().uuid(),
  content: z.string().trim().min(1).max(12000),
})

async function requireStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.is_admin !== true) {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, supabase }
}

async function ensureCaseForOrderRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: OrderSupportRequestRow,
) {
  return ensureCaseForOrderSupport(supabase, {
    id: row.id,
    request_type: row.request_type,
    body: row.body,
    buyer_id: row.buyer_id,
    order_id: row.order_id,
    order_ref: row.order_ref,
    requester_role: row.requester_role,
  })
}

function serviceRoleOrSession(session: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServiceRoleClient()
  } catch {
    return session
  }
}

/**
 * Ensures the canonical support_cases row for an order case.
 * Does not create a marketplace conversation.
 */
export async function ensureOrderSupportThreadService(
  caseId: string,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getOrderSupportRequestById(staff.supabase, caseId)
  if (!row) return { error: "Case not found" }

  return linkOrderSupportThread(row)
}

/** Ensures the support_cases row. Never writes marketplace conversations. */
export async function linkOrderSupportThread(
  row: OrderSupportRequestRow,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Messaging is not available in this environment." }
  }
  const opened = await ensureCaseForOrderRow(service, row)
  if (!opened) return { error: "Could not open the support case." }
  return {
    success: true,
    support_conversation_id: row.support_conversation_id ?? opened.id,
  }
}

export async function sendOrderSupportAdminReplyService(
  raw: unknown,
): Promise<{ success: true; support_conversation_id: string } | { error: string }> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  const row = await getOrderSupportRequestById(staff.supabase, parsed.data.case_id)
  if (!row) return { error: "Case not found" }

  const opened = await ensureCaseForOrderRow(serviceRoleOrSession(staff.supabase), row)
  if (!opened) return { error: "Could not open the support case." }

  const posted = await sendSupportCaseAdminReplyService({
    case_id: opened.id,
    content: parsed.data.content.trim(),
  })
  if ("error" in posted) return posted

  return {
    success: true,
    support_conversation_id: row.support_conversation_id ?? opened.id,
  }
}

/** Member reply on an order case thread (Help portal). */
export async function sendOrderSupportMemberReplyService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in to reply." }

  const row = await getOrderSupportRequestById(supabase, parsed.data.case_id)
  if (!row || row.buyer_id !== user.id) {
    return { error: "Case not found." }
  }

  const opened = await ensureCaseForOrderRow(serviceRoleOrSession(supabase), row)
  if (!opened) {
    return { error: "Could not open your support case. Try again in a moment." }
  }

  const posted = await sendSupportCaseMemberReplyForSession(
    supabase,
    user.id,
    opened.id,
    parsed.data.content.trim(),
  )
  if ("error" in posted) return posted
  return { success: true }
}
