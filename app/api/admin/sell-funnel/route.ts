import { NextRequest, NextResponse } from "next/server"

import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getSellFunnelAnalyticsForAdmin } from "@/lib/services/sellFunnelAnalytics"
import { sellFunnelAnalyticsQuerySchema } from "@/lib/validations/sell-funnel-analytics"

export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = sellFunnelAnalyticsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const result = await getSellFunnelAnalyticsForAdmin(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 })
    }
    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Could not load sell funnel analytics" }, { status: 500 })
  }
}
