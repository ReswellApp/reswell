import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { listOpenOpsGroupsForCounts, listOpsGroups, listRecentOpsIngestRuns } from "@/lib/db/ops"
import type { OpsGroupStatus, OpsSource } from "@/lib/types/ops"
import {
  countOpsGroupsByView,
  filterOpsGroupsByView,
  isOpsView,
  type OpsView,
} from "@/lib/utils/opsClassify"

/**
 * GET /api/admin/ops?view=&status=&q=
 * Staff-only list of ops groups + ingest health + per-view open counts.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const url = req.nextUrl
  const statusParam = url.searchParams.get("status") ?? "open"
  const viewParam = url.searchParams.get("view") ?? "overview"
  const q = url.searchParams.get("q") ?? undefined

  const status =
    statusParam === "all" ||
    statusParam === "open" ||
    statusParam === "acknowledged" ||
    statusParam === "resolved" ||
    statusParam === "ignored"
      ? (statusParam as OpsGroupStatus | "all")
      : "open"

  const view: OpsView = isOpsView(viewParam) ? viewParam : "overview"

  const sourceForQuery: OpsSource | "all" =
    view === "overview"
      ? "all"
      : view === "react" || view === "client"
        ? "client"
        : view

  try {
    const [rawGroups, openForCounts, runs] = await Promise.all([
      listOpsGroups(gate.ctx.supabase, {
        status,
        source: sourceForQuery,
        q,
        limit: 200,
      }),
      listOpenOpsGroupsForCounts(gate.ctx.supabase, 500),
      listRecentOpsIngestRuns(gate.ctx.supabase, 12),
    ])

    const groups = filterOpsGroupsByView(rawGroups, view)
    const counts = countOpsGroupsByView(openForCounts)

    return NextResponse.json(
      {
        data: {
          view,
          groups,
          runs,
          counts,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ops"
    console.error("[api/admin/ops]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
