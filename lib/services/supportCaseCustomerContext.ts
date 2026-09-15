import {
  dbCountAdminUserDetailOrders,
  dbFindAdminUserDetailProfileByEmail,
  dbGetAdminUserDetailProfile,
  dbGetAdminUserListingCounts,
  dbGetAdminUserOrderCommerce,
  dbListAdminUserDetailOrdersPage,
  type AdminUserDetailProfileRow,
} from "@/lib/db/adminUserDetail"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"
import {
  countSupportCasesForCustomer,
  insertSupportCaseEvent,
  linkSupportCaseToOrderAdmin,
  listSupportCasesForCustomerPage,
  resolveSupportCaseByAnyId,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  CUSTOMER_PANEL_PAGE_SIZE,
  buildCustomerPanelFlags,
  emptyCustomerCommerce,
  toSupportCaseCustomerOrder,
  toSupportCaseCustomerTicket,
  type CustomerPanelCommerce,
  type CustomerPanelFlag,
  type SupportCaseCustomerOrder,
  type SupportCaseCustomerTicket,
} from "@/lib/admin/case-customer-panel"
import {
  linkSupportCaseOrderSchema,
  supportCaseCustomerContextSchema,
  supportCaseCustomerOrdersPageSchema,
  supportCaseCustomerTicketsPageSchema,
} from "@/lib/validations/supportCaseCustomerContext"
import { parseInboxCaseParam } from "@/lib/utils/support-case-paths"

export type {
  CustomerPanelCommerce,
  CustomerPanelFlag,
  SupportCaseCustomerOrder,
  SupportCaseCustomerTicket,
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
  flags: CustomerPanelFlag[]
  commerce: CustomerPanelCommerce
  tickets: SupportCaseCustomerTicket[]
  ticketsHasMore: boolean
  ticketsTotal: number
  ticketsOpen: number
  /** @deprecated Use `tickets` — kept for older rail callers. */
  relatedCases: SupportCaseCustomerTicket[]
  orders: SupportCaseCustomerOrder[]
  ordersHasMore: boolean
  ordersTotal: number
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

function resolveCaseId(raw: string): string {
  return parseInboxCaseParam(raw) ?? raw.trim()
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

function ticketIdentity(supportCase: SupportCaseRow, profileId: string | null) {
  return {
    userId: profileId ?? supportCase.requester_user_id,
    email: supportCase.requester_email,
    excludeCaseId: supportCase.id,
  }
}

function emptyContext(flags: CustomerPanelFlag[]): SupportCaseCustomerContext {
  return {
    profile: null,
    matchedByEmail: false,
    flags,
    commerce: emptyCustomerCommerce(),
    tickets: [],
    ticketsHasMore: false,
    ticketsTotal: 0,
    ticketsOpen: 0,
    relatedCases: [],
    orders: [],
    ordersHasMore: false,
    ordersTotal: 0,
  }
}

function withRelatedCases(
  context: SupportCaseCustomerContext,
): SupportCaseCustomerContext {
  return { ...context, relatedCases: context.tickets }
}

export async function getSupportCaseCustomerContextService(
  raw: unknown,
): Promise<{ data: SupportCaseCustomerContext } | { error: string }> {
  const parsed = supportCaseCustomerContextSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(
    staff.service,
    resolveCaseId(parsed.data.case_id),
  )
  if (!supportCase) return { error: "Case not found." }

  const resolved = await resolveCaseProfile(staff.service, supportCase)
  const identity = ticketIdentity(supportCase, resolved.profile?.id ?? null)
  const ticketFilter = {
    userId: identity.userId,
    email: identity.email,
    excludeCaseId: identity.excludeCaseId,
    limit: CUSTOMER_PANEL_PAGE_SIZE,
    offset: 0,
  }

  if (!resolved.profile) {
    const [tickets, ticketsTotal, ticketsOpen] = await Promise.all([
      listSupportCasesForCustomerPage(staff.service, ticketFilter),
      countSupportCasesForCustomer(staff.service, {
        userId: identity.userId,
        email: identity.email,
        excludeCaseId: identity.excludeCaseId,
      }),
      countSupportCasesForCustomer(staff.service, {
        userId: identity.userId,
        email: identity.email,
        openOnly: true,
      }),
    ])
    return {
      data: withRelatedCases({
        ...emptyContext(
          buildCustomerPanelFlags({
            hasProfile: false,
            matchedByEmail: false,
            isShop: false,
            verified: false,
            sellerBanned: false,
            isStaff: false,
            openTicketCount: ticketsOpen,
          }),
        ),
        tickets: tickets.rows.map(toSupportCaseCustomerTicket),
        ticketsHasMore: tickets.hasMore,
        ticketsTotal,
        ticketsOpen,
      }),
    }
  }

  const profile = resolved.profile
  const [orders, ordersTotal, listingCounts, commerce, customerTickets, ticketsTotal, ticketsOpen, ban] =
    await Promise.all([
      dbListAdminUserDetailOrdersPage(staff.service, profile.id, {
        limit: CUSTOMER_PANEL_PAGE_SIZE,
        offset: 0,
        role: "all",
      }),
      dbCountAdminUserDetailOrders(staff.service, profile.id, "all"),
      dbGetAdminUserListingCounts(staff.service, profile.id),
      dbGetAdminUserOrderCommerce(staff.service, profile.id),
      listSupportCasesForCustomerPage(staff.service, ticketFilter),
      countSupportCasesForCustomer(staff.service, {
        userId: identity.userId,
        email: identity.email,
        excludeCaseId: identity.excludeCaseId,
      }),
      countSupportCasesForCustomer(staff.service, {
        userId: identity.userId,
        email: identity.email,
        openOnly: true,
      }),
      fetchSellerBanState(staff.service, profile.id),
    ])

  const location = profile.location?.trim() || profile.city?.trim() || null
  const tickets = customerTickets.rows.map(toSupportCaseCustomerTicket)

  return {
    data: withRelatedCases({
      profile: {
        id: profile.id,
        displayName: profile.display_name?.trim() || profile.email?.trim() || "Customer",
        email: profile.email,
        phone: profile.phone,
        location,
        createdAt: profile.created_at,
        isShop: profile.is_shop,
        shopName: profile.shop_name,
        verified: profile.shop_verified,
      },
      matchedByEmail: resolved.matchedByEmail,
      flags: buildCustomerPanelFlags({
        hasProfile: true,
        matchedByEmail: resolved.matchedByEmail,
        isShop: profile.is_shop,
        verified: profile.shop_verified,
        sellerBanned: isSellerBanActive(ban),
        isStaff: profile.is_admin || profile.is_employee,
        openTicketCount: ticketsOpen,
      }),
      commerce: {
        purchases: commerce.purchases,
        purchaseSpend: commerce.purchaseSpend,
        sales: commerce.sales,
        salesVolume: commerce.salesVolume,
        listings: listingCounts.total,
        activeListings: listingCounts.active,
        soldListings: listingCounts.sold,
      },
      tickets,
      ticketsHasMore: customerTickets.hasMore,
      ticketsTotal,
      ticketsOpen,
      orders: orders.rows.map((order) => toSupportCaseCustomerOrder(order, profile.id)),
      ordersHasMore: orders.hasMore,
      ordersTotal,
    }),
  }
}

export async function listSupportCaseCustomerOrdersService(
  raw: unknown,
): Promise<
  | { orders: SupportCaseCustomerOrder[]; hasMore: boolean; total: number }
  | { error: string }
> {
  const parsed = supportCaseCustomerOrdersPageSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid order page." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(
    staff.service,
    resolveCaseId(parsed.data.case_id),
  )
  if (!supportCase) return { error: "Case not found." }

  const resolved = await resolveCaseProfile(staff.service, supportCase)
  const profile = resolved.profile
  if (!profile) return { orders: [], hasMore: false, total: 0 }

  const [page, total] = await Promise.all([
    dbListAdminUserDetailOrdersPage(staff.service, profile.id, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      role: parsed.data.role,
      search: parsed.data.search,
    }),
    dbCountAdminUserDetailOrders(staff.service, profile.id, parsed.data.role),
  ])

  return {
    orders: page.rows.map((order) => toSupportCaseCustomerOrder(order, profile.id)),
    hasMore: page.hasMore,
    total,
  }
}

export async function listSupportCaseCustomerTicketsService(
  raw: unknown,
): Promise<
  | { tickets: SupportCaseCustomerTicket[]; hasMore: boolean; total: number }
  | { error: string }
> {
  const parsed = supportCaseCustomerTicketsPageSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid ticket page." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(
    staff.service,
    resolveCaseId(parsed.data.case_id),
  )
  if (!supportCase) return { error: "Case not found." }

  const resolved = await resolveCaseProfile(staff.service, supportCase)
  const identity = ticketIdentity(supportCase, resolved.profile?.id ?? null)
  const [page, total] = await Promise.all([
    listSupportCasesForCustomerPage(staff.service, {
      userId: identity.userId,
      email: identity.email,
      excludeCaseId: identity.excludeCaseId,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }),
    countSupportCasesForCustomer(staff.service, {
      userId: identity.userId,
      email: identity.email,
      excludeCaseId: identity.excludeCaseId,
    }),
  ])

  return {
    tickets: page.rows.map(toSupportCaseCustomerTicket),
    hasMore: page.hasMore,
    total,
  }
}

export async function linkSupportCaseOrderService(
  raw: unknown,
): Promise<{ success: true; order: SupportCaseCustomerOrder } | { error: string }> {
  const parsed = linkSupportCaseOrderSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid case or order." }

  const staff = await requireStaffService()
  if (!staff.ok) return { error: staff.error }
  const supportCase = await resolveSupportCaseByAnyId(
    staff.service,
    resolveCaseId(parsed.data.case_id),
  )
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
