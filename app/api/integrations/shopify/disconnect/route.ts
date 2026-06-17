import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { disconnectShopifyConnection } from "@/lib/db/shopify-connections"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"

/**
 * POST /api/integrations/shopify/disconnect
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

  const serviceSupabase = createServiceRoleClient()
  await disconnectShopifyConnection(serviceSupabase, user.id)

  return NextResponse.json({ success: true })
}
