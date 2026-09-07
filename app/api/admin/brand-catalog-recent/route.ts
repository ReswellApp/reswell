import { NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getBrandCatalogRecentSnapshot } from "@/lib/services/brandCatalogRecent"

export async function GET() {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  try {
    const data = await getBrandCatalogRecentSnapshot(gate.ctx.supabase)
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("getBrandCatalogRecentSnapshot failed:", message)
    return NextResponse.json({ error: "Could not load catalog ingest" }, { status: 500 })
  }
}
