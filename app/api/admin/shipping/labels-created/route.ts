import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { listOrderAdminShippingLabels } from "@/lib/db/adminOrderShippingLabels"
import { z } from "zod"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  source: z
    .enum(["shipengine_checkout_lane", "manual_label_upload", "manual_tracking_buyer"])
    .optional(),
  carrier: z.string().trim().max(120).optional(),
  q: z.string().trim().max(160).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/labels-created
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
  const { data: rows, total, error } = await listOrderAdminShippingLabels(supabase, {
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    filters: {
      source: parsed.data.source ?? null,
      carrier: parsed.data.carrier ?? null,
      search: parsed.data.q ?? null,
      dateFrom: parsed.data.date_from ?? null,
      dateTo: parsed.data.date_to ?? null,
    },
  })
  if (error) {
    console.error("[admin labels-created list]", error)
    return NextResponse.json({ error: "Could not load labels" }, { status: 500 })
  }

  const orderIds = [...new Set(rows.map((r) => r.order_id))]
  if (orderIds.length === 0) {
    return NextResponse.json({ data: [], total: 0 })
  }

  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("id, order_num, buyer_id, seller_id")
    .in("id", orderIds)

  if (ordErr) {
    console.error("[admin labels-created orders]", ordErr)
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
    console.error("[admin labels-created profiles]", profErr)
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

  const orderMap = new Map(
    (orders ?? []).map((o) => [
      o.id as string,
      {
        order_num: o.order_num as string | null,
        buyer_id: o.buyer_id as string,
        seller_id: o.seller_id as string,
      },
    ]),
  )

  const enriched = rows.map((row) => {
    const ord = orderMap.get(row.order_id)
    const buyer = ord ? profMap.get(ord.buyer_id) : undefined
    const seller = ord ? profMap.get(ord.seller_id) : undefined
    return {
      ...row,
      orderDisplayNum: ord ? formatOrderNumForCustomer(ord.order_num, row.order_id) : row.order_id.slice(0, 8),
      buyer: buyer
        ? { display_name: buyer.display_name, email: buyer.email }
        : { display_name: null, email: null },
      seller: seller
        ? { display_name: seller.display_name, email: seller.email }
        : { display_name: null, email: null },
    }
  })

  return NextResponse.json({ data: enriched, total })
}
