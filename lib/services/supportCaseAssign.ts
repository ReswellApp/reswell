import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { updateContactMessageRow } from "@/lib/db/contactMessages"
import { updateOrderSupportRequestAdmin } from "@/lib/db/order-support"
import {
  getSupportCaseByContactMessageId,
  getSupportCaseById,
  getSupportCaseByOrderSupportId,
  insertSupportCaseEvent,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import { assignSupportCaseSchema } from "@/lib/validations/supportCaseAssign"

export async function assignSupportCaseService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = assignSupportCaseSchema.safeParse(raw)
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

  const assigneeId = parsed.data.assignee_admin_id

  if (parsed.data.backend === "support_case") {
    let service
    try {
      service = createServiceRoleClient()
    } catch {
      service = supabase
    }
    const row = await getSupportCaseById(service, parsed.data.id)
    if (!row) return { error: "Case not found" }
    const { error } = await updateSupportCaseAdmin(service, {
      id: row.id,
      assignee_admin_id: assigneeId,
    })
    if (error) return { error: error.message }
    await insertSupportCaseEvent(service, {
      case_id: row.id,
      actor_admin_id: user.id,
      event_type: "assigned",
      payload: { assignee_admin_id: assigneeId },
    })
    if (row.order_support_request_id) {
      await updateOrderSupportRequestAdmin(service, {
        id: row.order_support_request_id,
        assignee_admin_id: assigneeId,
      })
    }
    if (row.contact_message_id) {
      await updateContactMessageRow(service, {
        id: row.contact_message_id,
        assignee_admin_id: assigneeId,
      })
    }
    return { success: true }
  }

  if (parsed.data.backend === "order_support") {
    const { error } = await updateOrderSupportRequestAdmin(supabase, {
      id: parsed.data.id,
      assignee_admin_id: assigneeId,
    })
    if (error) return { error: error.message }

    try {
      const service = createServiceRoleClient()
      const shadow = await getSupportCaseByOrderSupportId(service, parsed.data.id)
      if (shadow) {
        await updateSupportCaseAdmin(service, {
          id: shadow.id,
          assignee_admin_id: assigneeId,
        })
        await insertSupportCaseEvent(service, {
          case_id: shadow.id,
          actor_admin_id: user.id,
          event_type: "assigned",
          payload: { assignee_admin_id: assigneeId },
        })
      }
    } catch {
      // Shadow table optional until Phase 2
    }

    return { success: true }
  }

  const { error } = await updateContactMessageRow(supabase, {
    id: parsed.data.id,
    assignee_admin_id: assigneeId,
  })
  if (error) {
    if (error.message.toLowerCase().includes("assignee_admin_id")) {
      return { error: "Assignment isn’t available yet. Apply the latest database migration." }
    }
    return { error: error.message }
  }

  try {
    const service = createServiceRoleClient()
    const shadow = await getSupportCaseByContactMessageId(service, parsed.data.id)
    if (shadow) {
      await updateSupportCaseAdmin(service, {
        id: shadow.id,
        assignee_admin_id: assigneeId,
      })
      await insertSupportCaseEvent(service, {
        case_id: shadow.id,
        actor_admin_id: user.id,
        event_type: "assigned",
        payload: { assignee_admin_id: assigneeId },
      })
    }
  } catch {
    // Shadow table optional
  }

  return { success: true }
}
