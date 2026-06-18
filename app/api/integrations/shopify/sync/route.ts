import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"

/**
 * POST /api/integrations/shopify/sync
 * Enqueue a full catalog sync (background). Returns immediately; progress shows in the activity log.
 */
export async function POST() {
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

  const connection = await getActiveShopifyConnectionForUser(supabase, user.id)
  if (!connection) {
    return NextResponse.json({ error: "Connect a Shopify store first" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const { enqueued } = await enqueueShopifySyncJob(serviceSupabase, {
    userId: user.id,
    connectionId: connection.id,
    jobType: "full_catalog_sync",
    dedupeKey: `full_catalog_sync:${connection.id}`,
  })

  return NextResponse.json({
    success: true,
    enqueued,
    message: enqueued ? "Full sync started" : "A full sync is already in progress",
  })
}
