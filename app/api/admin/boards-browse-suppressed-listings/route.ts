import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listSuppressedSurfboardsForBoardsAdmin } from "@/lib/db/boards-browse-suppressed-admin"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const rows = await listSuppressedSurfboardsForBoardsAdmin(gate.ctx.supabase)
  return NextResponse.json({ data: { rows } }, { status: 200 })
}
