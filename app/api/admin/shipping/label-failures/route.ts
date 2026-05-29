import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  dismissOpenOrderShippingLabelFailure,
  dismissOpenOrderShippingLabelFailures,
  listOpenOrderShippingLabelFailures,
} from "@/lib/db/orderShippingLabelFailures"
import { z } from "zod"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const postSchema = z
  .object({
    order_id: z.string().uuid().optional(),
    order_ids: z.array(z.string().uuid()).min(1).max(100).optional(),
    action: z.enum(["dismiss"]),
  })
  .refine((v) => Boolean(v.order_id) || Boolean(v.order_ids?.length), {
    message: "order_id or order_ids is required",
  })

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/label-failures — open automated label failures.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: rows, total, error } = await listOpenOrderShippingLabelFailures(supabase, parsed.data)
  if (error) {
    console.error("[admin label-failures list]", error)
    return NextResponse.json({ error: "Could not load failures" }, { status: 500 })
  }

  const orderIds = [...new Set(rows.map((r) => r.order_id))]
  if (orderIds.length === 0) {
    return NextResponse.json({ data: [], total: 0, openCount: 0 })
  }

  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      fulfillment_method,
      delivery_status,
      shipping_amount,
      created_at,
      listings ( id, title, section )
    `,
    )
    .in("id", orderIds)

  if (ordErr) {
    console.error("[admin label-failures orders]", ordErr)
    return NextResponse.json({ error: "Could not load orders" }, { status: 500 })
  }

  const profileIds = new Set<string>()
  for (const o of orders ?? []) {
    profileIds.add(o.buyer_id as string)
    profileIds.add(o.seller_id as string)
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", [...profileIds])

  if (profErr) {
    console.error("[admin label-failures profiles]", profErr)
    return NextResponse.json({ error: "Could not load profiles" }, { status: 500 })
  }

  const profMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        display_name: p.display_name as string | null,
        email: p.email as string | null,
      },
    ]),
  )

  type OrderRow = {
    id: string
    order_num: string | null
    buyer_id: string
    seller_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_amount: string | number | null
    created_at: string
    listings: { title?: string | null; section?: string | null } | { title?: string | null; section?: string | null }[] | null
  }

  const orderMap = new Map<string, OrderRow>(
    (orders ?? []).map((o) => [o.id as string, o as unknown as OrderRow]),
  )

  const enriched = rows.map((row) => {
    const ord = orderMap.get(row.order_id)
    const listing = ord?.listings
      ? Array.isArray(ord.listings)
        ? ord.listings[0]
        : ord.listings
      : null
    const buyer = ord ? profMap.get(ord.buyer_id) : undefined
    const seller = ord ? profMap.get(ord.seller_id) : undefined
    return {
      ...row,
      orderDisplayNum: ord ? formatOrderNumForCustomer(ord.order_num, row.order_id) : row.order_id.slice(0, 8),
      orderCreatedAt: ord?.created_at ?? null,
      listingTitle: listing?.title?.trim() || "Item",
      listingSection: listing?.section ?? null,
      fulfillmentMethod: ord?.fulfillment_method ?? null,
      deliveryStatus: ord?.delivery_status ?? null,
      buyerPaidShippingUsd: ord?.shipping_amount != null ? Number(ord.shipping_amount) : null,
      buyer: buyer
        ? { display_name: buyer.display_name, email: buyer.email }
        : { display_name: null, email: null },
      seller: seller
        ? { display_name: seller.display_name, email: seller.email }
        : { display_name: null, email: null },
    }
  })

  return NextResponse.json({ data: enriched, total, openCount: total })
}

/**
 * POST /api/admin/shipping/label-failures — dismiss an open failure.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (parsed.data.order_ids?.length) {
    const result = await dismissOpenOrderShippingLabelFailures(
      supabase,
      parsed.data.order_ids,
      gate.ctx.user.id,
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, dismissed: result.dismissed })
  }

  const result = await dismissOpenOrderShippingLabelFailure(
    supabase,
    parsed.data.order_id as string,
    gate.ctx.user.id,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({ success: true, dismissed: 1 })
}
