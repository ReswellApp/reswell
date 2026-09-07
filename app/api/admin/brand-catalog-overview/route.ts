import { NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getBrandCatalogOverview } from "@/lib/services/brandCatalogOverview"

export async function GET() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  try {
    const data = await getBrandCatalogOverview(gate.ctx.supabase)
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("getBrandCatalogOverview failed:", message)
    return NextResponse.json({ error: "Could not load brand catalog" }, { status: 500 })
  }
}
