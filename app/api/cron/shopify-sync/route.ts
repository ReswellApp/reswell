import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { runShopifySyncWorker } from "@/lib/services/shopifySyncWorker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Drains the Shopify sync job queue (order push, fulfillment, catalog sync, reconcile).
 * Protected with CRON_SECRET, same pattern as other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  try {
    const result = await runShopifySyncWorker(supabase, 25)
    return NextResponse.json({ ...result, ran_at: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
