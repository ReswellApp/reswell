import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import {
  dbCountAdminUserDetailOrders,
  dbGetAdminUserDetailProfile,
  dbListAdminUserDetailOrdersPage,
} from "@/lib/db/adminUserDetail"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"
import {
  insertSupportCase,
  insertSupportCaseEvent,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  toSupportCaseCustomerOrder,
  type SupportCaseCustomerOrder,
} from "@/lib/admin/case-customer-panel"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendSupportCaseAdminReplyService } from "@/lib/services/supportCaseThread"
import {
  adminCreateSupportCaseSchema,
  adminUserOrdersForSupportSchema,
} from "@/lib/validations/adminCreateSupportCase"
import type { SupportCaseKind } from "@/lib/types/supportCase"

export type AdminCreateSupportCaseResult = {
  success: true
  caseId: string
  orderId: string | null
  /** True when Klaviyo accepted the Support Tickets Response event. */
  klaviyoNotified: boolean
}

type StaffServiceContext =
  | {
      ok: true
      staffId: string
      service: ReturnType<typeof createServiceRoleClient>
    }
  | { ok: false; error: string }

async function requireStaffService(): Promise<StaffServiceContext> {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return { ok: false, error: "Unauthorized" }
  try {
    return {
      ok: true,
      staffId: gate.ctx.user.id,
      service: createServiceRoleClient(),
    }
  } catch {
    return { ok: false, error: "Support tickets are unavailable." }
  }
}

function requesterRoleForOrder(
  userId: string,
  order: { buyer_id: string | null; seller_id: string },
): "buyer" | "seller" | null {
  if (order.buyer_id === userId) return "buyer"
  if (order.seller_id === userId) return "seller"
  return null
}

export async function listAdminUserOrdersForSupportService(
  raw: unknown,
): Promise<
  | { orders: SupportCaseCustomerOrder[]; hasMore: boolean; total: number }
  | { error: string }
> {
  const parsed = adminUserOrdersForSupportSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid order search." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }

  const profile = await dbGetAdminUserDetailProfile(staff.service, parsed.data.user_id)
  if (!profile.ok) return { error: profile.message }

  const [page, total] = await Promise.all([
    dbListAdminUserDetailOrdersPage(staff.service, profile.profile.id, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      role: parsed.data.role,
      search: parsed.data.search,
    }),
    dbCountAdminUserDetailOrders(staff.service, profile.profile.id, {
      role: parsed.data.role,
      search: parsed.data.search,
    }),
  ])

  return {
    orders: page.rows.map((order) => toSupportCaseCustomerOrder(order, profile.profile.id)),
    hasMore: page.hasMore,
    total,
  }
}

export async function adminCreateSupportCaseService(
  raw: unknown,
): Promise<AdminCreateSupportCaseResult | { error: string }> {
  const parsed = adminCreateSupportCaseSchema.safeParse(raw)
  if (!parsed.success) return { error: "Check the member, subject, and message." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }

  const profile = await dbGetAdminUserDetailProfile(staff.service, parsed.data.user_id)
  if (!profile.ok) return { error: profile.message }

  const kind: SupportCaseKind = parsed.data.kind
  const subject = parsed.data.subject.trim()
  const message = parsed.data.message.trim()
  const requesterEmail =
    profile.profile.email?.trim() || (await getAuthEmailForUserId(profile.profile.id))
  let requesterRole: "buyer" | "seller" | "member" = "member"
  let orderId: string | null = null
  let orderRef: string | null = null
  let listingId: string | null = null

  if (parsed.data.order_id) {
    const orderResult = await getOrderDetailForAdmin(staff.service, parsed.data.order_id)
    if (orderResult.error || !orderResult.data) return { error: "Order not found." }
    const role = requesterRoleForOrder(profile.profile.id, orderResult.data)
    if (!role) return { error: "That order does not belong to this member." }
    requesterRole = role
    orderId = orderResult.data.id
    orderRef = orderResult.data.order_num
    listingId = orderResult.data.listing_id
  }

  const inserted = await insertSupportCase(staff.service, {
    kind,
    subject,
    preview: message,
    requester_user_id: profile.profile.id,
    requester_email: requesterEmail,
    requester_role: requesterRole,
    order_id: orderId,
    order_ref: orderRef,
    listing_id: listingId,
    source_channel: "staff",
    opened_by: "staff",
    priority: parsed.data.priority ?? (kind === "safety" ? "urgent" : "normal"),
  })
  if (!inserted.data) {
    return { error: inserted.error?.message ?? "Could not open a support ticket." }
  }

  const sent = await sendSupportCaseAdminReplyService({
    case_id: inserted.data.id,
    content: message,
  })
  if ("error" in sent) return { error: sent.error }

  await updateSupportCaseAdmin(staff.service, {
    id: inserted.data.id,
    status: "waiting_on_you",
    assignee_admin_id: staff.staffId,
  })

  await Promise.all([
    insertSupportCaseEvent(staff.service, {
      case_id: inserted.data.id,
      actor_admin_id: staff.staffId,
      event_type: "staff_opened",
      payload: {
        user_id: profile.profile.id,
        kind,
        order_id: orderId,
        order_ref: orderRef,
        customer_role: requesterRole,
      },
    }),
    insertSupportCaseEvent(staff.service, {
      case_id: inserted.data.id,
      actor_admin_id: staff.staffId,
      event_type: "assigned",
      payload: { assignee_admin_id: staff.staffId },
    }),
    orderId
      ? insertSupportCaseEvent(staff.service, {
          case_id: inserted.data.id,
          actor_admin_id: staff.staffId,
          event_type: "order_linked",
          payload: {
            from_order_id: null,
            order_id: orderId,
            order_ref: orderRef,
            customer_role: requesterRole,
          },
        })
      : Promise.resolve(),
  ])

  return {
    success: true,
    caseId: inserted.data.id,
    orderId,
    klaviyoNotified: sent.klaviyoNotified,
  }
}
