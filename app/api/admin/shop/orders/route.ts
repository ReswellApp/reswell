import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isPostgrestSchemaStaleError } from "@/lib/db/adminOrders"
import {
  getAdminReswellShopOrderCounts,
  listAdminReswellShopOrders,
} from "@/lib/db/adminReswellShopOrders"
import { adminReswellShopOrdersQuerySchema } from "@/lib/validations/reswellShopOrderFulfillment"

/**
 * GET /api/admin/shop/orders
 *
 * Paginated Reswell shop orders from the shared `orders` table
 * (`listings.section = new`). Includes fulfillment KPIs.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = adminReswellShopOrdersQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()

  const [listResult, countsResult] = await Promise.all([
    listAdminReswellShopOrders(serviceSupabase, parsed.data),
    getAdminReswellShopOrderCounts(serviceSupabase),
  ])

  if (listResult.error) {
    if (isPostgrestSchemaStaleError(listResult.error)) {
      return NextResponse.json(
        {
          error:
            "Database API schema is out of date. Apply pending migrations, then reload the Supabase API schema.",
        },
        { status: 503 },
      )
    }
    console.error("[admin shop orders list]", listResult.error)
    return NextResponse.json({ error: "Could not load shop orders" }, { status: 500 })
  }

  if (countsResult.error) {
    console.error("[admin shop orders counts]", countsResult.error)
  }

  return NextResponse.json({
    data: listResult.data,
    total: listResult.total,
    counts: countsResult.data,
  })
}
