import type { SupabaseClient } from "@supabase/supabase-js"

export type DropoffDashboardOrderRecord = {
  id: string
  orderNum: string | null
  status: string
  deliveryStatus: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  createdAt: string
  sellerName: string | null
  title: string
  hasLabel: boolean
}

const ORDER_SELECT = `
  id,
  order_num,
  status,
  delivery_status,
  tracking_number,
  tracking_carrier,
  created_at,
  seller_id,
  listing_id,
  fulfillment_method,
  is_admin_test
`.trim()

const IN_CHUNK = 80
const ORDER_CAP = 100

type OrderRaw = {
  id: string
  order_num: string | null
  status: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  created_at: string
  seller_id: string
  listing_id: string | null
  fulfillment_method: string | null
  is_admin_test: boolean | null
}

function deliveryRank(status: string | null): number {
  if (status === "pending") return 0
  if (status === "shipped") return 1
  return 2
}

async function selectInChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(...(await run(ids.slice(i, i + IN_CHUNK))))
  }
  return out
}

function shippingOrders(supabase: SupabaseClient) {
  return supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("fulfillment_method", "shipping")
    .eq("is_admin_test", false)
    .in("status", ["confirmed", "refunding"])
}

function asOrders(data: unknown): OrderRaw[] {
  return (Array.isArray(data) ? data : []) as OrderRaw[]
}

async function labelOrderIds(supabase: SupabaseClient, orderIds: string[]): Promise<Set<string>> {
  const prepared = new Set<string>()
  if (orderIds.length === 0) return prepared

  const rows = await selectInChunks(orderIds, async (chunk) => {
    const [marketplaceRes, adminRes] = await Promise.all([
      supabase
        .from("order_shipping_labels")
        .select("order_id, label_pdf_url, label_storage_path, tracking_number")
        .in("order_id", chunk),
      supabase
        .from("order_admin_shipping_labels")
        .select("order_id, label_pdf_url, label_storage_path, tracking_number")
        .in("order_id", chunk),
    ])
    if (marketplaceRes.error) throw marketplaceRes.error
    if (adminRes.error) throw adminRes.error
    return [...(marketplaceRes.data ?? []), ...(adminRes.data ?? [])] as Array<{
      order_id?: string
      label_pdf_url?: string | null
      label_storage_path?: string | null
      tracking_number?: string | null
    }>
  })

  for (const row of rows) {
    const printable = Boolean(
      row.label_pdf_url?.trim() || row.label_storage_path?.trim() || row.tracking_number?.trim(),
    )
    if (printable && row.order_id) prepared.add(row.order_id)
  }
  return prepared
}

export async function listDropoffShippingOrders(
  supabase: SupabaseClient,
  locationId: string,
): Promise<DropoffDashboardOrderRecord[]> {
  const { data: listingRows, error: listingError } = await supabase
    .from("listings")
    .select("id, title")
    .eq("dropoff_location_id", locationId)
  if (listingError) throw listingError

  const listings = (listingRows ?? []) as Array<{ id: string; title: string | null }>
  const titleById = new Map(listings.map((row) => [row.id, row.title?.trim() || "Surfboard"]))
  const listingIds = listings.map((row) => row.id)
  if (listingIds.length === 0) return []

  const direct = await selectInChunks(listingIds, async (chunk) => {
    const [waitingRes, recentRes] = await Promise.all([
      shippingOrders(supabase)
        .in("listing_id", chunk)
        .eq("delivery_status", "pending")
        .order("created_at", { ascending: false })
        .limit(ORDER_CAP),
      shippingOrders(supabase)
        .in("listing_id", chunk)
        .neq("delivery_status", "pending")
        .order("created_at", { ascending: false })
        .limit(40),
    ])
    if (waitingRes.error) throw waitingRes.error
    if (recentRes.error) throw recentRes.error
    return [...asOrders(waitingRes.data), ...asOrders(recentRes.data)]
  })

  const itemLinks = await selectInChunks(listingIds, async (chunk) => {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id, listing_id")
      .in("listing_id", chunk)
    if (error) throw error
    return (data ?? []) as Array<{ order_id: string; listing_id: string | null }>
  })

  const directIds = new Set(direct.map((order) => order.id))
  const extraIds = [...new Set(itemLinks.map((link) => link.order_id).filter((id) => !directIds.has(id)))]
  const extra = await selectInChunks(extraIds, async (chunk) => {
    const { data, error } = await shippingOrders(supabase)
      .in("id", chunk)
      .order("created_at", { ascending: false })
      .limit(ORDER_CAP)
    if (error) throw error
    return asOrders(data)
  })

  const orders = [...direct, ...extra]
  orders.sort((a, b) => {
    const rank = deliveryRank(a.delivery_status) - deliveryRank(b.delivery_status)
    if (rank !== 0) return rank
    return b.created_at.localeCompare(a.created_at)
  })
  const visible = orders.slice(0, ORDER_CAP)

  const titlesByOrder = new Map<string, string[]>()
  for (const order of visible) {
    const title = order.listing_id ? titleById.get(order.listing_id) : undefined
    if (title) titlesByOrder.set(order.id, [title])
  }
  for (const link of itemLinks) {
    if (!visible.some((order) => order.id === link.order_id)) continue
    const title = link.listing_id ? titleById.get(link.listing_id) : undefined
    if (!title) continue
    const current = titlesByOrder.get(link.order_id) ?? []
    if (!current.includes(title)) current.push(title)
    titlesByOrder.set(link.order_id, current)
  }

  const sellerIds = [...new Set(visible.map((order) => order.seller_id).filter(Boolean))]
  const sellerName = new Map<string, string>()
  if (sellerIds.length > 0) {
    const profiles = await selectInChunks(sellerIds, async (chunk) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", chunk)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>
    })
    for (const profile of profiles) {
      const name = profile.display_name?.trim() || profile.email?.trim() || ""
      if (name) sellerName.set(profile.id, name)
    }
  }

  const labeled = await labelOrderIds(
    supabase,
    visible.map((order) => order.id),
  )

  return visible.map((order) => ({
    id: order.id,
    orderNum: order.order_num,
    status: order.status ?? "confirmed",
    deliveryStatus: order.delivery_status,
    trackingNumber: order.tracking_number,
    trackingCarrier: order.tracking_carrier,
    createdAt: order.created_at,
    sellerName: sellerName.get(order.seller_id) ?? null,
    title: titlesByOrder.get(order.id)?.join(", ") || "Surfboard",
    hasLabel: labeled.has(order.id) || Boolean(order.tracking_number?.trim()),
  }))
}

export async function orderListingDropoffIds(
  supabase: SupabaseClient,
  orderId: string,
): Promise<Array<string | null>> {
  const { data, error } = await supabase
    .from("orders")
    .select("listing_id, order_items ( listing_id )")
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  const order = data as {
    listing_id?: string | null
    order_items?: Array<{ listing_id?: string | null }> | { listing_id?: string | null } | null
  }
  const itemRows = Array.isArray(order.order_items)
    ? order.order_items
    : order.order_items
      ? [order.order_items]
      : []
  const listingIds = [order.listing_id, ...itemRows.map((item) => item.listing_id)].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  )
  if (listingIds.length === 0) return []

  const { data: listings, error: listingError } = await supabase
    .from("listings")
    .select("id, dropoff_location_id")
    .in("id", listingIds)
  if (listingError) throw listingError
  return ((listings ?? []) as Array<{ dropoff_location_id?: string | null }>).map(
    (row) => row.dropoff_location_id ?? null,
  )
}
