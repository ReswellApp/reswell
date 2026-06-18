import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getActiveShopifyConnectionForUser,
  updateShopifyConnectionSettings,
} from "@/lib/db/shopify-connections"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import { shopifyChannelSettingsSchema } from "@/lib/validations/shopify"

/**
 * POST /api/integrations/shopify/settings
 * Update the seller's channel sync + pricing settings.
 */
export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = shopifyChannelSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const connection = await getActiveShopifyConnectionForUser(supabase, user.id)
  if (!connection) {
    return NextResponse.json({ error: "Connect a Shopify store first" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  await updateShopifyConnectionSettings(serviceSupabase, connection.id, user.id, parsed.data)

  return NextResponse.json({ success: true })
}
