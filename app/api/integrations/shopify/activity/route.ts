import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listShopifySyncJobsForUser } from "@/lib/db/shopify-sync-jobs"
import { listShopifyOrderLinksForUser } from "@/lib/db/shopify-order-links"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"

/**
 * GET /api/integrations/shopify/activity
 * Recent sync jobs + order links for the seller's channel health view.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await checkShopifyConnectAccess(supabase, user.id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const [jobs, orders] = await Promise.all([
    listShopifySyncJobsForUser(supabase, user.id, 50),
    listShopifyOrderLinksForUser(supabase, user.id, 50),
  ])

  return NextResponse.json({
    data: {
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        attempts: j.attempts,
        lastError: j.last_error,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        reswellOrderId: o.reswell_order_id,
        shopifyOrderName: o.shopify_order_name,
        status: o.sync_status,
        lastError: o.last_error,
        createdAt: o.created_at,
      })),
    },
  })
}
