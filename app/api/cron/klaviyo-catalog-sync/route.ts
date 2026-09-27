import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { reconcileKlaviyoCatalogPublishedState } from "@/lib/services/klaviyoCatalogSync"

/**
 * Republish Klaviyo catalog items that are still unpublished, and push listings
 * updated in the last 6 hours. Listing mutations also sync immediately.
 *
 * GET /api/cron/klaviyo-catalog-sync
 * Protected with CRON_SECRET when set. Scheduled in vercel.json every 10 minutes.
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
    const summary = await reconcileKlaviyoCatalogPublishedState(supabase)
    return NextResponse.json({
      ...summary,
      reference_time: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[klaviyo-catalog] reconcile failed", { message })
    return NextResponse.json({ error: "Failed to sync Klaviyo catalog" }, { status: 500 })
  }
}
