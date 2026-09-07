import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listContactMessagesByIds, normalizeContactMessageRow } from "@/lib/db/contactMessages"
import {
  listOrderSupportRequestsByIds,
  normalizeOrderSupportRow,
} from "@/lib/db/order-support"
import { listSupportCasesAdmin } from "@/lib/db/supportCases"
import {
  supportCaseToInboxItem,
  type CaseInboxItem,
} from "@/lib/admin/case-inbox"
import {
  ensureCaseForContactMessage,
  ensureCaseForOrderSupport,
} from "@/lib/services/supportCaseBackfill"

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false as const, error: "Forbidden" }
  }
  return { ok: true as const, supabase }
}

export async function listAdminSupportInboxService(): Promise<
  { items: CaseInboxItem[] } | { error: string }
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    service = staff.supabase
  }

  const existing = await listSupportCasesAdmin(service, 400)
  const haveContact = new Set(
    existing.map((row) => row.contact_message_id).filter((id): id is string => Boolean(id)),
  )
  const haveOrder = new Set(
    existing
      .map((row) => row.order_support_request_id)
      .filter((id): id is string => Boolean(id)),
  )

  const [cmRes, osRes] = await Promise.all([
    service
      .from("contact_messages")
      .select("id, name, email, subject, message, created_at, source, user_id")
      .order("created_at", { ascending: false })
      .limit(400),
    service
      .from("order_support_requests")
      .select("id, request_type, body, buyer_id, order_id, order_ref, requester_role")
      .order("created_at", { ascending: false })
      .limit(400),
  ])

  const missingContact = (cmRes.data ?? []).filter(
    (raw) => !haveContact.has(String((raw as { id: string }).id)),
  )
  const missingOrder = (osRes.data ?? []).filter(
    (raw) => !haveOrder.has(String((raw as { id: string }).id)),
  )

  if (missingContact.length > 0 || missingOrder.length > 0) {
    await Promise.all([
      ...missingContact.map((raw) => {
        const row = normalizeContactMessageRow({
          ...(raw as Record<string, unknown>),
          support_status: "new",
          internal_notes: null,
          updated_at: (raw as { created_at: string }).created_at,
        })
        return ensureCaseForContactMessage(service, {
          id: row.id,
          subject: row.subject,
          message: row.message,
          email: row.email,
          user_id: row.user_id,
          source: row.source,
        })
      }),
      ...missingOrder.map((raw) => {
        const row = normalizeOrderSupportRow({
          ...(raw as Record<string, unknown>),
          support_status: "new",
          assignee_admin_id: null,
          internal_notes: null,
          outcome: null,
          updated_at: new Date().toISOString(),
        })
        return ensureCaseForOrderSupport(service, {
          id: row.id,
          request_type: row.request_type,
          body: row.body,
          buyer_id: row.buyer_id,
          order_id: row.order_id,
          order_ref: row.order_ref,
          requester_role: row.requester_role,
        })
      }),
    ])
  }

  const cases =
    missingContact.length > 0 || missingOrder.length > 0
      ? await listSupportCasesAdmin(service, 400)
      : existing
  const contactIds = cases
    .map((row) => row.contact_message_id)
    .filter((id): id is string => Boolean(id))
  const orderIds = cases
    .map((row) => row.order_support_request_id)
    .filter((id): id is string => Boolean(id))

  const [contacts, orders] = await Promise.all([
    listContactMessagesByIds(service, contactIds),
    listOrderSupportRequestsByIds(service, orderIds),
  ])
  const contactById = new Map(contacts.map((row) => [row.id, row]))
  const orderById = new Map(orders.map((row) => [row.id, row]))

  return {
    items: cases.map((row) =>
      supportCaseToInboxItem(row, {
        contact: row.contact_message_id ? contactById.get(row.contact_message_id) ?? null : null,
        order: row.order_support_request_id ? orderById.get(row.order_support_request_id) ?? null : null,
      }),
    ),
  }
}
