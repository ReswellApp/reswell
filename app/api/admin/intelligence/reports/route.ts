import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/brands/admin-server"
import { generateAndStoreIntelligenceReport } from "@/lib/services/businessIntelligence"
import {
  getBusinessIntelligenceReport,
  listBusinessIntelligenceReports,
} from "@/lib/db/businessIntelligenceReports"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  businessIntelligenceGenerateSchema,
  businessIntelligenceQuerySchema,
} from "@/lib/validations/businessIntelligence"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Saved Intelligence reports.
 * GET /api/admin/intelligence/reports?kind=daily&limit=40
 * POST /api/admin/intelligence/reports  { kind, periodKey?, force? }
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = businessIntelligenceQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const db = createServiceRoleClient()
    if (parsed.data.kind && parsed.data.periodKey) {
      const { row, error } = await getBusinessIntelligenceReport(
        db,
        parsed.data.kind,
        parsed.data.periodKey,
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: row }, { status: 200 })
    }
    const { rows, error } = await listBusinessIntelligenceReports(db, parsed.data)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: rows }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/intelligence/reports]", message)
    return NextResponse.json({ error: "Could not load reports" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = businessIntelligenceGenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generate payload" }, { status: 400 })
  }

  try {
    const result = await generateAndStoreIntelligenceReport(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }
    return NextResponse.json(
      { data: result.data, reused: result.reused },
      { status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[admin/intelligence/reports] generate", message)
    return NextResponse.json({ error: "Could not generate the report" }, { status: 500 })
  }
}
