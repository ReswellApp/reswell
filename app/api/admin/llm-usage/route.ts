import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  getLlmUsageDashboard,
  parseLlmUsageRangeDays,
} from "@/lib/services/llmUsageDashboard"

export const dynamic = "force-dynamic"

/**
 * LLM models + Vercel AI Gateway spend for the admin dashboard.
 * GET /api/admin/llm-usage?days=30
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const days = parseLlmUsageRangeDays(request.nextUrl.searchParams.get("days"))

  try {
    const data = await getLlmUsageDashboard({ days })
    return NextResponse.json({ data }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/llm-usage]", message)
    return NextResponse.json({ error: "Could not load LLM usage data" }, { status: 500 })
  }
}
