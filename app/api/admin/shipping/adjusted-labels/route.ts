import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { dbListIncreasedLabelAdjustments } from "@/lib/db/shipengineLabelAdjustments"
import { syncShipEngineLabelAdjustments } from "@/lib/services/syncShipEngineLabelAdjustments"
import { z } from "zod"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/shipping/adjusted-labels — labels whose ShipEngine fee increased.
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
  const { data: rows, total, error } = await dbListIncreasedLabelAdjustments(supabase, parsed.data)
  if (error) {
    console.error("[admin adjusted-labels list]", error)
    return NextResponse.json({ error: "Could not load adjusted labels" }, { status: 500 })
  }

  const orderIds = [...new Set(rows.map((row) => row.order_id).filter((id): id is string => Boolean(id)))]
  const orderMap = new Map<string, { order_num: string | null }>()
  if (orderIds.length > 0) {
    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("id, order_num")
      .in("id", orderIds)
    if (ordErr) {
      console.error("[admin adjusted-labels orders]", ordErr)
      return NextResponse.json({ error: "Could not load orders" }, { status: 500 })
    }
    for (const order of orders ?? []) {
      orderMap.set(order.id as string, { order_num: (order.order_num as string | null) ?? null })
    }
  }

  const enriched = rows.map((row) => {
    const order = row.order_id ? orderMap.get(row.order_id) : null
    return {
      ...row,
      orderDisplayNum: order
        ? formatOrderNumForCustomer(order.order_num, row.order_id ?? "")
        : null,
    }
  })

  return NextResponse.json({ data: enriched, total })
}

/**
 * POST /api/admin/shipping/adjusted-labels — pull the latest ShipEngine reports now.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let force = false
  try {
    const body = (await request.json()) as { force?: unknown }
    force = body.force === true
  } catch {
    force = false
  }

  const result = await syncShipEngineLabelAdjustments({ force })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json({ data: result.summary })
}
