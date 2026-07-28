import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"
import type { AdminReswellShopOrdersQuery } from "@/lib/validations/reswellShopOrderFulfillment"
import { z } from "zod"

export type AdminReswellShopOrderRow = {
  id: string
  order_num: string | null
  status: string
  amount: number
  payment_method: string
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  listing_id: string
  listing_title: string | null
  is_admin_test: boolean
  shipping_address: {
    name?: string | null
    phone?: string | null
    email?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    } | null
  } | null
  buyer: {
    display_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

export type AdminReswellShopOrderCounts = {
  total: number
  awaiting_shipment: number
  shipped: number
  delivered: number
}

function unwrapRelation<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Paginated Reswell shop orders — same `orders` table, filtered to primary listing
 * `section = new` (Reswell retail inventory).
 */
export async function listAdminReswellShopOrders(
  supabase: SupabaseClient,
  query: AdminReswellShopOrdersQuery,
): Promise<{
  data: AdminReswellShopOrderRow[]
  total: number
  error: PostgrestError | null
}> {
  const { status, fulfillment, q, sort, dir, limit, offset } = query

  let builder = supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      status,
      amount,
      payment_method,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      created_at,
      refunded_at,
      buyer_id,
      seller_id,
      listing_id,
      is_admin_test,
      shipping_address,
      listings!inner (
        id,
        title,
        section
      )
    `,
      { count: "exact" },
    )
    .eq("listings.section", RESWELL_SHOP_SECTION)
    .order(sort, { ascending: dir === "asc" })
    .range(offset, offset + limit - 1)

  if (status !== "all") {
    builder = builder.eq("status", status)
  }

  if (fulfillment === "awaiting_shipment") {
    builder = builder
      .eq("status", "confirmed")
      .eq("fulfillment_method", "shipping")
      .eq("delivery_status", "pending")
  } else if (fulfillment === "shipped") {
    builder = builder.eq("delivery_status", "shipped")
  } else if (fulfillment === "delivered") {
    builder = builder.eq("delivery_status", "delivered")
  }

  if (q?.trim()) {
    const term = q.trim()
    const uuidParsed = z.string().uuid().safeParse(term)
    if (uuidParsed.success) {
      builder = builder.eq("id", uuidParsed.data)
    } else {
      builder = builder.ilike("order_num", `%${term}%`)
    }
  }

  const { data, error, count } = await builder
  if (error) {
    return { data: [], total: 0, error }
  }

  const rows = data ?? []
  const buyerIds = Array.from(
    new Set(
      rows
        .map((r) => r.buyer_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  )

  const buyerById = new Map<
    string,
    { display_name: string | null; email: string | null; avatar_url: string | null }
  >()
  if (buyerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", buyerIds)
    for (const p of profiles ?? []) {
      buyerById.set(p.id as string, {
        display_name: (p.display_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      })
    }
  }

  const enriched: AdminReswellShopOrderRow[] = rows.map((r) => {
    const listing = unwrapRelation(
      r.listings as
        | { id?: string; title?: string | null; section?: string }
        | { id?: string; title?: string | null; section?: string }[]
        | null,
    )
    const shipRaw = r.shipping_address
    const shipping_address =
      shipRaw && typeof shipRaw === "object" && !Array.isArray(shipRaw)
        ? (shipRaw as AdminReswellShopOrderRow["shipping_address"])
        : null

    return {
      id: r.id as string,
      order_num: (r.order_num as string | null) ?? null,
      status: r.status as string,
      amount: num(r.amount as string | number),
      payment_method: r.payment_method as string,
      fulfillment_method: (r.fulfillment_method as string | null) ?? null,
      delivery_status: (r.delivery_status as string | null) ?? null,
      tracking_number: (r.tracking_number as string | null) ?? null,
      tracking_carrier: (r.tracking_carrier as string | null) ?? null,
      created_at: r.created_at as string,
      refunded_at: (r.refunded_at as string | null) ?? null,
      buyer_id: (r.buyer_id as string | null) ?? null,
      seller_id: r.seller_id as string,
      listing_id: r.listing_id as string,
      listing_title: typeof listing?.title === "string" ? listing.title : null,
      is_admin_test: Boolean(r.is_admin_test),
      shipping_address,
      buyer: r.buyer_id ? (buyerById.get(r.buyer_id as string) ?? null) : null,
    }
  })

  return { data: enriched, total: count ?? 0, error: null }
}

/**
 * Cheap head-count KPIs for the Reswell shop fulfillment queue.
 */
export async function getAdminReswellShopOrderCounts(
  supabase: SupabaseClient,
): Promise<{ data: AdminReswellShopOrderCounts | null; error: PostgrestError | null }> {
  const base = () =>
    supabase
      .from("orders")
      .select("id, listings!inner(section)", { count: "exact", head: true })
      .eq("listings.section", RESWELL_SHOP_SECTION)

  const [totalRes, awaitingRes, shippedRes, deliveredRes] = await Promise.all([
    base(),
    base()
      .eq("status", "confirmed")
      .eq("fulfillment_method", "shipping")
      .eq("delivery_status", "pending"),
    base().eq("delivery_status", "shipped"),
    base().eq("delivery_status", "delivered"),
  ])

  for (const res of [totalRes, awaitingRes, shippedRes, deliveredRes]) {
    if (res.error) {
      return { data: null, error: res.error }
    }
  }

  return {
    data: {
      total: totalRes.count ?? 0,
      awaiting_shipment: awaitingRes.count ?? 0,
      shipped: shippedRes.count ?? 0,
      delivered: deliveredRes.count ?? 0,
    },
    error: null,
  }
}
