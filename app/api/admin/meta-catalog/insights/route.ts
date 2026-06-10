import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { buildMetaCatalogInsights } from "@/lib/services/metaCatalogInsights"

export const dynamic = "force-dynamic"

const ALLOWED_RANGE_DAYS = new Set([7, 28, 90])

/**
 * Meta Commerce catalog + ads intelligence for the admin dashboard.
 * GET /api/admin/meta-catalog/insights?days=28
 *
 * Admin-only. Always returns 200 with a `configured: false` payload (feed + pixel health still
 * populated) when the Catalog Graph API is not connected.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const daysParam = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "", 10)
  const days = ALLOWED_RANGE_DAYS.has(daysParam) ? daysParam : 28

  try {
    const insights = await buildMetaCatalogInsights(gate.ctx.supabase, { days })
    return NextResponse.json({ data: insights }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/meta-catalog/insights]", message)
    return NextResponse.json({ error: "Could not load Meta catalog insights" }, { status: 500 })
  }
}
