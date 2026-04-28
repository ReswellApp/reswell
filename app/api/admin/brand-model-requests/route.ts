import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listBrandModelRequestsForAdmin } from "@/lib/db/brand-model-requests"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const result = await listBrandModelRequestsForAdmin(gate.ctx.supabase)
  if (!result.ok) {
    return NextResponse.json({ error: "Could not load model requests" }, { status: 500 })
  }
  return NextResponse.json({ requests: result.rows })
}
