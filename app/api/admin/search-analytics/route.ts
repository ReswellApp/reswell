import { NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getSearchSourcingDashboardService } from "@/lib/services/searchSourcingDashboard"

export async function GET() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const data = await getSearchSourcingDashboardService()
  return NextResponse.json({ data }, { status: 200 })
}
