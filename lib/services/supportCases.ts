import { createClient } from "@/lib/supabase/server"
import type { UserSupportTicketFilter } from "@/lib/db/contactMessages"
import { getOrderSupportRequestForUser } from "@/lib/db/order-support"
import { listSupportCasesForRequester } from "@/lib/db/supportCases"
import { backfillUserLegacyCases } from "@/lib/services/supportCaseBackfill"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import { supportCaseResponseHref } from "@/lib/utils/support-case-paths"
import { humanizeSupportCasePreview } from "@/lib/utils/humanize-support-case-preview"
import { isUnpublishedLiveChatTicket } from "@/lib/help/unpublished-live-chat"

export async function listUserSupportCasesService(
  userId: string,
  filter: UserSupportTicketFilter = "all",
): Promise<UserSupportCaseListItem[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await backfillUserLegacyCases(supabase, userId, user?.email ?? null)

  const rows = await listSupportCasesForRequester(supabase, userId, filter)
  return rows.filter((row) => !isUnpublishedLiveChatTicket(row)).map((row) => ({
    id: row.id,
    backend: row.order_support_request_id ? "order_support" : "contact_message",
    kind: row.kind,
    status: row.status,
    subject: row.subject,
    preview: humanizeSupportCasePreview(row.preview),
    orderId: row.order_id,
    orderRef: row.order_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasThread: true,
    href: supportCaseResponseHref(row.id),
  }))
}

export async function countOpenUserSupportCasesService(userId: string): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await backfillUserLegacyCases(supabase, userId, user?.email ?? null)
  const open = await listSupportCasesForRequester(supabase, userId, "open")
  return open.filter((row) => !isUnpublishedLiveChatTicket(row)).length
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
