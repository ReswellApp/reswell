import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Nightly: enqueue a reconcile job for every active Shopify connection so any missed webhooks
 * (downtime, dropped deliveries) are caught and re-synced. Protected with CRON_SECRET.
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

  const { data: connections, error } = await supabase
    .from("shopify_connections")
    .select("id, user_id")
    .eq("status", "active")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let enqueued = 0
  for (const conn of connections ?? []) {
    const { enqueued: didEnqueue } = await enqueueShopifySyncJob(supabase, {
      userId: conn.user_id as string,
      connectionId: conn.id as string,
      jobType: "reconcile",
      dedupeKey: `reconcile:${conn.id}`,
    })
    if (didEnqueue) enqueued += 1
  }

  return NextResponse.json({ connections: connections?.length ?? 0, enqueued })
}
