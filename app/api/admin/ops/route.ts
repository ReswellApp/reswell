import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { listOpsGroups, listRecentOpsIngestRuns } from "@/lib/db/ops"
import type { OpsGroupStatus, OpsSource } from "@/lib/types/ops"

/**
 * GET /api/admin/ops?status=&source=&q=
 * Staff-only list of ops groups + recent ingest runs.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const url = req.nextUrl
  const statusParam = url.searchParams.get("status") ?? "open"
  const sourceParam = url.searchParams.get("source") ?? "all"
  const q = url.searchParams.get("q") ?? undefined

  const status =
    statusParam === "all" ||
    statusParam === "open" ||
    statusParam === "acknowledged" ||
    statusParam === "resolved" ||
    statusParam === "ignored"
      ? (statusParam as OpsGroupStatus | "all")
      : "open"

  const source =
    sourceParam === "all" ||
    sourceParam === "vercel" ||
    sourceParam === "supabase" ||
    sourceParam === "client" ||
    sourceParam === "server"
      ? (sourceParam as OpsSource | "all")
      : "all"

  try {
    const [groups, runs] = await Promise.all([
      listOpsGroups(gate.ctx.supabase, { status, source, q, limit: 150 }),
      listRecentOpsIngestRuns(gate.ctx.supabase, 8),
    ])
    return NextResponse.json({ data: { groups, runs } }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ops"
    console.error("[api/admin/ops]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
