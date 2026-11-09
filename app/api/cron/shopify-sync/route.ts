import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isShopifyIntegrationEnabled } from "@/lib/shopify/config"
import {
  enqueueScheduledShopifyReconciliations,
  runShopifyWorkers,
} from "@/lib/services/shopifyWorker"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isShopifyIntegrationEnabled()) {
    return NextResponse.json({ ok: true, skipped: "integration_disabled" })
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const reconciliationsEnqueued =
      await enqueueScheduledShopifyReconciliations(serviceSupabase)
    const workers = await runShopifyWorkers(serviceSupabase, 10)
    return NextResponse.json({
      ok: true,
      reconciliationsEnqueued,
      ...workers,
      referenceTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[shopify] cron", error)
    return NextResponse.json({ error: "Shopify sync failed" }, { status: 500 })
  }
}
