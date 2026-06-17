import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import { replaceShopifySectionMappings } from "@/lib/db/shopify-section-mappings"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import { shopifyMappingsBodySchema } from "@/lib/validations/shopify"

/**
 * PUT /api/integrations/shopify/mappings
 * Replace section mapping rules for the active Shopify connection.
 */
export async function PUT(request: NextRequest) {
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

  const parsed = shopifyMappingsBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mappings payload" }, { status: 400 })
  }

  const connection = await getActiveShopifyConnectionForUser(supabase, user.id)
  if (!connection) {
    return NextResponse.json({ error: "Connect a Shopify store first" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  await replaceShopifySectionMappings(
    serviceSupabase,
    user.id,
    connection.id,
    parsed.data.mappings,
  )

  return NextResponse.json({ success: true })
}
