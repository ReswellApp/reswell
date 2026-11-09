import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { fetchReswellBucksReconcileSummary } from "@/lib/db/reswellBucksLedger"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** Full admin: balanced-journal totals for Reswell Bucks checkouts. */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  try {
    const supabase = createServiceRoleClient()
    const summary = await fetchReswellBucksReconcileSummary(supabase)
    if (!summary) {
      return NextResponse.json({ error: "Could not load Reswell Bucks reconciliation." }, { status: 500 })
    }
    const balanced =
      summary.unbalanced_count === 0 &&
      summary.wallet_link_drift_count === 0 &&
      summary.total_debit_cents === summary.total_credit_cents
    return NextResponse.json({ data: { ...summary, balanced } })
  } catch (err) {
    console.error("[admin/reswell-bucks/reconcile]", err)
    return NextResponse.json({ error: "Could not load Reswell Bucks reconciliation." }, { status: 500 })
  }
}
