import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  applyAdminAdjustmentDispute,
  listAdminAdjustmentDisputes,
} from "@/lib/services/shippingAdjustmentDispute"

export const dynamic = "force-dynamic"

const disputeStatusQuery = z.enum([
  "submitted_to_reswell",
  "submitted_to_carrier",
  "resolved",
  "denied",
  "open",
])

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: disputeStatusQuery.optional(),
})

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const result = await listAdminAdjustmentDisputes(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ data: result.data, total: result.total })
  } catch (error) {
    console.error("[admin adjustment disputes]", error)
    return NextResponse.json({ error: "Could not load adjustment disputes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    const result = await applyAdminAdjustmentDispute(body, gate.ctx.user.id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[admin adjustment dispute update]", error)
    return NextResponse.json({ error: "Could not update this dispute" }, { status: 500 })
  }
}
