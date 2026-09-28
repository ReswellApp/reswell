import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdsManagerDashboard } from "@/lib/services/adsManager"
import type { AdsRangeDays } from "@/lib/types/adsManager"
import { adsManagerQuerySchema } from "@/lib/validations/adsManager"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** GET /api/admin/ads-manager?days=30 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = adsManagerQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const data = await getAdsManagerDashboard(parsed.data.days as AdsRangeDays)
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    console.error(
      "[ads-manager]",
      JSON.stringify({ userId: gate.ctx.user.id, op: "get", at: new Date().toISOString(), message: message.slice(0, 500) }),
    )
    return NextResponse.json({ error: "Could not load the ads manager" }, { status: 500 })
  }
}
