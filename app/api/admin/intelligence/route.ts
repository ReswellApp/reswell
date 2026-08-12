import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/brands/admin-server"
import { loadIntelligenceDashboard } from "@/lib/services/businessIntelligence"

export const dynamic = "force-dynamic"

/**
 * Live Intelligence dashboard: 30-day KPIs, monthly GMV, top URLs, latest saved reports.
 * GET /api/admin/intelligence
 */
export async function GET(_request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const data = await loadIntelligenceDashboard()
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/intelligence]", message)
    return NextResponse.json({ error: "Could not load Intelligence" }, { status: 500 })
  }
}
