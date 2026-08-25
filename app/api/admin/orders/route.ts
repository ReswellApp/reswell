import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { isPostgrestSchemaStaleError } from "@/lib/db/adminOrders"
import { z } from "zod"

const querySchema = z.object({
  status: z.enum(["all", "confirmed", "refunding", "refunded", "pending"]).optional().default("all"),
  open: z.enum(["all", "shipping", "pickup", "none"]).optional().default("none"),
  payment: z.enum(["all", "stripe", "reswell_bucks"]).optional().default("all"),
  test: z.enum(["all", "real", "test"]).optional().default("all"),
  q: z.string().optional(),
  sort: z.enum(["created_at", "amount"]).optional().default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

type PartyLabel = { display_name: string | null; email: string | null; avatar_url: string | null }

/**
 * GET /api/admin/orders
 *
 * Paginated order list for admin / support staff. Supports payment-status, open-fulfillment
 * (same buckets as the home tiles), payment method, text search (order_num or full order id as
 * UUID), and sort by date or amount. Buyer/seller labels are batch-resolved (single query — no N+1).
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

  const { status, open, payment, test, q, sort, dir, limit, offset } = parsed.data
  const serviceSupabase = createServiceRoleClient()

  let query = serviceSupabase
    .from("orders")
    .select(
      "id, order_num, status, amount, payment_method, fulfillment_method, created_at, refunded_at, buyer_id, seller_id, is_admin_test",
      { count: "exact" },
    )
    .order(sort, { ascending: dir === "asc" })
    .range(offset, offset + limit - 1)

  if (open === "shipping") {
    query = query
      .eq("status", "confirmed")
      .eq("is_admin_test", false)
      .eq("fulfillment_method", "shipping")
      .in("delivery_status", ["pending", "shipped"])
  } else if (open === "pickup") {
    query = query
      .eq("status", "confirmed")
      .eq("is_admin_test", false)
      .eq("fulfillment_method", "pickup")
      .neq("delivery_status", "picked_up")
  } else if (open === "all") {
    query = query
      .eq("status", "confirmed")
      .eq("is_admin_test", false)
      .or(
        "and(fulfillment_method.eq.shipping,delivery_status.in.(pending,shipped)),and(fulfillment_method.eq.pickup,delivery_status.neq.picked_up)",
      )
  } else if (status !== "all") {
    query = query.eq("status", status)
  }

  if (payment !== "all") {
    query = query.eq("payment_method", payment)
  }

  // Open-fulfillment buckets already exclude test seeds — don't re-apply test.
  if (open === "none") {
    if (test === "test") {
      query = query.eq("is_admin_test", true)
    } else if (test === "real") {
      query = query.eq("is_admin_test", false)
    }
  }

  if (q?.trim()) {
    const term = q.trim()
    const uuidParsed = z.string().uuid().safeParse(term)
    if (uuidParsed.success) {
      query = query.eq("id", uuidParsed.data)
    } else {
      query = query.ilike("order_num", `%${term}%`)
    }
  }

  const { data, error, count } = await query

  if (error) {
    if (isPostgrestSchemaStaleError(error)) {
      console.error("[admin orders list] schema/cache mismatch", error.code, error.message)
      return NextResponse.json(
        {
          error:
            "Database API schema is out of date (often after a migration). Apply pending migrations, then in Supabase: Project Settings → API → Reload schema.",
        },
        { status: 503 },
      )
    }
    console.error("[admin orders list]", error)
    return NextResponse.json({ error: "Could not load orders" }, { status: 500 })
  }

  const rows = data ?? []

  // Batch-resolve buyer/seller labels in a single query to avoid N+1.
  const partyIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.buyer_id, r.seller_id]).filter((id): id is string => typeof id === "string" && !!id),
    ),
  )

  const partyById = new Map<string, PartyLabel>()
  if (partyIds.length > 0) {
    const { data: profiles } = await serviceSupabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", partyIds)
    for (const p of profiles ?? []) {
      partyById.set(p.id as string, {
        display_name: (p.display_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      })
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    buyer: partyById.get(r.buyer_id) ?? null,
    seller: partyById.get(r.seller_id) ?? null,
  }))

  return NextResponse.json({ data: enriched, total: count ?? 0 })
}
