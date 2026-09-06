import { createClient } from "@/lib/supabase/server"
import {
  countOpenContactMessagesForUser,
  listContactMessagesForUser,
  type UserSupportTicketFilter,
} from "@/lib/db/contactMessages"
import {
  countOpenOrderSupportForUser,
  getOrderSupportRequestForUser,
  listOrderSupportRequestsForUser,
} from "@/lib/db/order-support"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import {
  contactStatusToCaseStatus,
  orderRequestTypeSubject,
  orderRequestTypeToKind,
  orderSupportStatusToCaseStatus,
} from "@/lib/utils/support-case-display"
import { supportTicketDisplaySubject as ticketSubject } from "@/lib/utils/support-ticket-display"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import { humanizeSupportCasePreview } from "@/lib/utils/humanize-support-case-preview"

export async function listUserSupportCasesService(
  userId: string,
  filter: UserSupportTicketFilter = "all",
): Promise<UserSupportCaseListItem[]> {
  const supabase = await createClient()

  const [tickets, orderRows] = await Promise.all([
    listContactMessagesForUser(supabase, userId, filter),
    listOrderSupportRequestsForUser(supabase, userId, filter),
  ])

  const fromTickets: UserSupportCaseListItem[] = tickets.map((t) => ({
    id: t.id,
    backend: "contact_message",
    kind: "general",
    status: contactStatusToCaseStatus(t.support_status),
    subject: ticketSubject(t.subject, t.source),
    preview: humanizeSupportCasePreview(t.message),
    orderId: null,
    orderRef: null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    hasThread: Boolean(t.support_conversation_id),
    href: supportCaseResponseHref(t.id),
  }))

  const fromOrders: UserSupportCaseListItem[] = orderRows.map((r) => ({
    id: r.id,
    backend: "order_support",
    kind: orderRequestTypeToKind(r.request_type),
    status: orderSupportStatusToCaseStatus(r.support_status),
    subject: orderRequestTypeSubject(r.request_type, r.order_ref),
    preview: humanizeSupportCasePreview(r.body),
    orderId: r.order_id,
    orderRef: r.order_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hasThread: Boolean(r.support_conversation_id),
    href: supportCaseResponseHref(r.id),
  }))

  return [...fromTickets, ...fromOrders].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function countOpenUserSupportCasesService(userId: string): Promise<number> {
  const supabase = await createClient()
  const [tickets, orders] = await Promise.all([
    countOpenContactMessagesForUser(supabase, userId),
    countOpenOrderSupportForUser(supabase, userId),
  ])
  return tickets + orders
}

export async function getUserOrderSupportCaseService(userId: string, requestId: string) {
  const supabase = await createClient()
  return getOrderSupportRequestForUser(supabase, userId, requestId)
}

export type HelpHubOrderOption = {
  id: string
  orderRef: string
  role: "buyer" | "seller"
  title: string
  status: string
  fulfillmentMethod: "shipping" | "pickup" | null
  deliveryStatus: string
  createdAt: string
}

/** Recent purchases + sales for the Help Hub order picker. */
export async function listHelpHubOrdersService(userId: string): Promise<HelpHubOrderOption[]> {
  const supabase = await createClient()

  const [purchases, sales] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_num, status, created_at, listing_id, fulfillment_method, delivery_status")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("orders")
      .select("id, order_num, status, created_at, listing_id, fulfillment_method, delivery_status")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ])

  const listingIds = Array.from(
    new Set(
      [...(purchases.data ?? []), ...(sales.data ?? [])]
        .map((o) => (o as { listing_id?: string | null }).listing_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const titleByListing = new Map<string, string>()
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title")
      .in("id", listingIds)
    for (const l of listings ?? []) {
      titleByListing.set(String((l as { id: string }).id), String((l as { title?: string }).title ?? "Order"))
    }
  }

  const formatRef = (orderNum: string | null | undefined, id: string) => {
    if (orderNum?.trim()) return orderNum.trim()
    return `Order ${id.slice(0, 8).toUpperCase()}`
  }

  const mapOrder = (
    row: {
      id: string
      order_num?: string | null
      status: string
      created_at: string
      listing_id?: string | null
      fulfillment_method?: string | null
      delivery_status?: string | null
    },
    role: "buyer" | "seller",
  ): HelpHubOrderOption => {
    const fm = row.fulfillment_method
    return {
      id: row.id,
      orderRef: formatRef(row.order_num, row.id),
      role,
      title: row.listing_id
        ? (titleByListing.get(row.listing_id) ?? (role === "buyer" ? "Purchase" : "Sale"))
        : role === "buyer"
          ? "Purchase"
          : "Sale",
      status: row.status,
      fulfillmentMethod: fm === "shipping" || fm === "pickup" ? fm : null,
      deliveryStatus: (row.delivery_status ?? "pending").trim() || "pending",
      createdAt: row.created_at,
    }
  }

  const purchaseOpts: HelpHubOrderOption[] = (purchases.data ?? []).map((o) =>
    mapOrder(o as Parameters<typeof mapOrder>[0], "buyer"),
  )

  const saleOpts: HelpHubOrderOption[] = (sales.data ?? []).map((o) =>
    mapOrder(o as Parameters<typeof mapOrder>[0], "seller"),
  )

  return [...purchaseOpts, ...saleOpts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
