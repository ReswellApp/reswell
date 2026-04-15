import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { z } from "zod"

const querySchema = z.object({
  status: z.enum(["all", "confirmed", "refunded", "pending"]).optional().default("all"),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/admin/orders
 *
 * Paginated order list for admin / support staff. Supports status filter and text search
 * (order_num or order id prefix).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { status, q, limit, offset } = parsed.data
  const serviceSupabase = createServiceRoleClient()

  let query = serviceSupabase
    .from("orders")
    .select(
      "id, order_num, status, amount, payment_method, fulfillment_method, created_at, refunded_at, buyer_id, seller_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== "all") {
    query = query.eq("status", status)
  }

  if (q?.trim()) {
    const term = q.trim()
    const isUuid = /^[0-9a-f]{8}-/i.test(term)
    if (isUuid) {
      query = query.eq("id", term)
    } else {
      query = query.ilike("order_num", `%${term}%`)
    }
  }

  const { data, error, count } = await query

  if (error) {
    console.error("[admin orders list]", error)
    return NextResponse.json({ error: "Could not load orders" }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}
