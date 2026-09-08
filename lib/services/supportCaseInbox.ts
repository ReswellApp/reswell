import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { updateContactMessageRow, type ContactMessageSupportStatus } from "@/lib/db/contactMessages"
import {
  updateOrderSupportRequestAdmin,
  type OrderSupportStatus,
} from "@/lib/db/order-support"
import {
  insertSupportCaseEvent,
  resolveSupportCaseByAnyId,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import { postSupportCaseSystemMessage } from "@/lib/services/supportCaseThread"
import { updateSupportCaseInboxSchema } from "@/lib/validations/supportCaseInbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"

function caseStatusToContact(status: SupportCaseStatus): ContactMessageSupportStatus {
  switch (status) {
    case "in_review":
      return "triaged"
    case "in_progress":
    case "waiting_on_you":
      return "ticket_created"
    case "resolved":
      return "resolved"
    case "submitted":
    default:
      return "new"
  }
}

function caseStatusToOrder(status: SupportCaseStatus): OrderSupportStatus {
  switch (status) {
    case "in_review":
      return "triaged"
    case "waiting_on_you":
      return "waiting_on_customer"
    case "in_progress":
      return "investigating"
    case "resolved":
      return "resolved"
    case "submitted":
    default:
      return "new"
  }
}

export async function updateSupportCaseInboxService(
  raw: unknown,
): Promise<{ success: true; status?: SupportCaseStatus } | { error: string }> {
  const parsed = updateSupportCaseInboxSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    service = supabase
  }

  const row = await resolveSupportCaseByAnyId(service, parsed.data.case_id)
  if (!row) return { error: "Case not found" }

  const nextStatus = parsed.data.status
  const { error } = await updateSupportCaseAdmin(service, {
    id: row.id,
    status: nextStatus,
    internal_notes: parsed.data.internal_notes,
    outcome: parsed.data.outcome,
  })
  if (error) return { error: "Could not update this conversation." }

  if (row.contact_message_id) {
    await updateContactMessageRow(service, {
      id: row.contact_message_id,
      support_status: nextStatus ? caseStatusToContact(nextStatus) : undefined,
      internal_notes: parsed.data.internal_notes,
    })
  }

  if (row.order_support_request_id) {
    await updateOrderSupportRequestAdmin(service, {
      id: row.order_support_request_id,
      support_status: nextStatus ? caseStatusToOrder(nextStatus) : undefined,
      internal_notes: parsed.data.internal_notes,
      outcome: parsed.data.outcome,
    })
  }

  if (nextStatus && nextStatus !== row.status) {
    await insertSupportCaseEvent(service, {
      case_id: row.id,
      actor_admin_id: user.id,
      event_type: nextStatus === "resolved" ? "resolved" : "status_changed",
      payload: { status: nextStatus },
    })
    await postSupportCaseSystemMessage(
      row.id,
      nextStatus === "resolved"
        ? "Conversation marked resolved."
        : `Status updated to ${nextStatus.replaceAll("_", " ")}.`,
    )
  }

  return { success: true, status: nextStatus ?? row.status }
}
