import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { getGoogleAnalyticsDashboardData } from "@/lib/services/googleAnalytics"

export const dynamic = "force-dynamic"

const ALLOWED_RANGE_DAYS = new Set([7, 28, 90])

/**
 * GA4 site + partner embed analytics for the admin dashboard.
 * GET /api/admin/google-analytics?days=28
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const daysParam = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "", 10)
  const days = ALLOWED_RANGE_DAYS.has(daysParam) ? daysParam : 28

  try {
    const data = await getGoogleAnalyticsDashboardData({ days })
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/google-analytics]", message)
    return NextResponse.json({ error: "Could not load Google Analytics data" }, { status: 500 })
  }
}
