import {
  dbFindAdminUserDetailProfileByEmail,
  dbGetAdminUserDetailProfile,
  dbGetAdminUserListingCounts,
  dbListAdminUserDetailOrders,
  type AdminUserDetailOrderRow,
  type AdminUserDetailProfileRow,
} from "@/lib/db/adminUserDetail"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"
import {
  insertSupportCaseEvent,
  linkSupportCaseToOrderAdmin,
  listSupportCasesForRequester,
  resolveSupportCaseByAnyId,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  linkSupportCaseOrderSchema,
  supportCaseCustomerContextSchema,
} from "@/lib/validations/supportCaseCustomerContext"

export type SupportCaseCustomerOrder = {
  id: string
  orderRef: string | null
  role: "buyer" | "seller"
  amount: number
  merchandiseAmount: number
  status: string
  createdAt: string
  listingId: string | null
  listingTitle: string | null
}

export type SupportCaseCustomerContext = {
  profile: {
    id: string
    displayName: string
    email: string | null
    phone: string | null
    location: string | null
    createdAt: string
    isShop: boolean
    shopName: string | null
    verified: boolean
  } | null
  matchedByEmail: boolean
  commerce: {
    purchases: number
    purchaseSpend: number
    sales: number
    salesVolume: number
    listings: number
    activeListings: number
    soldListings: number
  }
  relatedCases: {
    id: string
    subject: string
    status: string
    kind: string
    orderRef: string | null
    updatedAt: string
  }[]
  orders: SupportCaseCustomerOrder[]
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
    return { ok: false, error: "Customer context is unavailable." }
  }
}

async function resolveCaseProfile(
  service: ReturnType<typeof createServiceRoleClient>,
  supportCase: SupportCaseRow,
): Promise<{ profile: AdminUserDetailProfileRow | null; matchedByEmail: boolean }> {
  if (supportCase.requester_user_id) {
    const result = await dbGetAdminUserDetailProfile(service, supportCase.requester_user_id)
    return {
      profile: result.ok ? result.profile : null,
      matchedByEmail: false,
    }
  }
  if (!supportCase.requester_email) return { profile: null, matchedByEmail: false }
  return {
    profile: await dbFindAdminUserDetailProfileByEmail(service, supportCase.requester_email),
    matchedByEmail: true,
  }
}

function merchandiseAmount(order: AdminUserDetailOrderRow): number {
  return Math.max(0, order.amount - order.shipping_amount)
}

function toCustomerOrder(
  order: AdminUserDetailOrderRow,
  userId: string,
): SupportCaseCustomerOrder {
  return {
    id: order.id,
    orderRef: order.order_num,
    role: order.seller_id === userId ? "seller" : "buyer",
    amount: order.amount,
    merchandiseAmount: merchandiseAmount(order),
    status: order.status,
    createdAt: order.created_at,
    listingId: order.listing_id,
    listingTitle: order.listing_title,
  }
}

export async function getSupportCaseCustomerContextService(
  raw: unknown,
): Promise<{ data: SupportCaseCustomerContext } | { error: string }> {
  const parsed = supportCaseCustomerContextSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(staff.service, parsed.data.case_id)
  if (!supportCase) return { error: "Case not found." }

  const resolved = await resolveCaseProfile(staff.service, supportCase)
  if (!resolved.profile) {
    return {
      data: {
        profile: null,
        matchedByEmail: false,
        commerce: {
          purchases: 0,
          purchaseSpend: 0,
          sales: 0,
          salesVolume: 0,
          listings: 0,
          activeListings: 0,
          soldListings: 0,
        },
        relatedCases: [],
        orders: [],
      },
    }
  }
  const profile = resolved.profile

  const [orders, listingCounts, customerCases] = await Promise.all([
    dbListAdminUserDetailOrders(staff.service, profile.id, 500),
    dbGetAdminUserListingCounts(staff.service, profile.id),
    listSupportCasesForRequester(staff.service, profile.id),
  ])
  let purchases = 0
  let purchaseSpend = 0
  let sales = 0
  let salesVolume = 0
  for (const order of orders) {
    if (order.status !== "confirmed") continue
    const merchandise = merchandiseAmount(order)
    if (order.buyer_id === profile.id) {
      purchases += 1
      purchaseSpend += merchandise
    }
    if (order.seller_id === profile.id) {
      sales += 1
      salesVolume += merchandise
    }
  }

  const location =
    profile.location?.trim() ||
    profile.city?.trim() ||
    null

  return {
    data: {
      profile: {
        id: profile.id,
        displayName:
          profile.display_name?.trim() ||
          profile.email?.trim() ||
          "Customer",
        email: profile.email,
        phone: profile.phone,
        location,
        createdAt: profile.created_at,
        isShop: profile.is_shop,
        shopName: profile.shop_name,
        verified: profile.shop_verified,
      },
      matchedByEmail: resolved.matchedByEmail,
      commerce: {
        purchases,
        purchaseSpend,
        sales,
        salesVolume,
        listings: listingCounts.total,
        activeListings: listingCounts.active,
        soldListings: listingCounts.sold,
      },
      relatedCases: customerCases
        .filter((row) => row.id !== supportCase.id)
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          subject: row.subject,
          status: row.status,
          kind: row.kind,
          orderRef: row.order_ref,
          updatedAt: row.updated_at,
        })),
      orders: orders.slice(0, 100).map((order) => toCustomerOrder(order, profile.id)),
    },
  }
}

export async function linkSupportCaseOrderService(
  raw: unknown,
): Promise<{ success: true; order: SupportCaseCustomerOrder } | { error: string }> {
  const parsed = linkSupportCaseOrderSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case or order." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(staff.service, parsed.data.case_id)
  if (!supportCase) return { error: "Case not found." }

  const resolved = await resolveCaseProfile(staff.service, supportCase)
  if (!resolved.profile) return { error: "This case is not connected to a Reswell account." }

  const orderResult = await getOrderDetailForAdmin(staff.service, parsed.data.order_id)
  if (orderResult.error || !orderResult.data) return { error: "Order not found." }
  const order = orderResult.data
  const role =
    order.buyer_id === resolved.profile.id
      ? "buyer"
      : order.seller_id === resolved.profile.id
        ? "seller"
        : null
  if (!role) return { error: "That order does not belong to this customer." }

  const linked = await linkSupportCaseToOrderAdmin(staff.service, {
    id: supportCase.id,
    order_id: order.id,
    order_ref: order.order_num,
    listing_id: order.listing_id,
    requester_user_id: resolved.profile.id,
  })
  if (linked.error) return { error: "Could not connect this order." }

  await insertSupportCaseEvent(staff.service, {
    case_id: supportCase.id,
    actor_admin_id: staff.staffId,
    event_type: "order_linked",
    payload: {
      from_order_id: supportCase.order_id,
      order_id: order.id,
      order_ref: order.order_num,
      customer_role: role,
    },
  })

  return {
    success: true,
    order: {
      id: order.id,
      orderRef: order.order_num,
      role,
      amount: order.amount,
      merchandiseAmount: order.item_price,
      status: order.status,
      createdAt: order.created_at,
      listingId: order.listing_id,
      listingTitle: order.listing_title,
    },
  }
}
