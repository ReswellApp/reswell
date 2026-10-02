import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  dbGetShipEngineAdjustmentClaimContext,
  dbListIncreasedLabelAdjustments,
} from "@/lib/db/shipengineLabelAdjustments"
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

  const claimContext = await dbGetShipEngineAdjustmentClaimContext(supabase, rows)
  if (claimContext.error) {
    console.error("[admin adjusted-labels claim context]", claimContext.error)
    return NextResponse.json({ error: "Could not load order details" }, { status: 500 })
  }

  const enriched = rows.map((row) => {
    const context = claimContext.data.get(row.id)
    return {
      ...row,
      orderDisplayNum: row.order_id
        ? formatOrderNumForCustomer(context?.orderNum ?? null, row.order_id)
        : null,
      itemTitle: context?.itemTitle ?? null,
      itemImageUrl: context?.itemImageUrl ?? null,
      sellerName: context?.sellerName ?? null,
      carrier: context?.carrier ?? null,
      hasOriginalLabel: context?.hasOriginalLabel ?? false,
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
