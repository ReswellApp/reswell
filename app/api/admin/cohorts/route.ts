import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/brands/admin-server"
import { getAdminCohortsDashboard } from "@/lib/services/adminCohorts"
import { adminCohortsQuerySchema } from "@/lib/validations/adminCohorts"

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = adminCohortsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  try {
    const result = await getAdminCohortsDashboard(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 })
    }
    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Could not load cohorts" }, { status: 500 })
  }
}
