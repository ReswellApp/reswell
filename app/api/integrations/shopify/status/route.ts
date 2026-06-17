import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listShopifyLinksForUser } from "@/lib/db/shopify-product-links"
import { listShopifySectionMappingsForUser } from "@/lib/db/shopify-section-mappings"
import {
  getActiveShopifyConnectionForUser,
  toPublicShopifyConnection,
} from "@/lib/db/shopify-connections"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import { isShopifyConfigured } from "@/lib/shopify/config"

/**
 * GET /api/integrations/shopify/status
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("shopify_connect_enabled, is_shop, shop_verified")
    .eq("id", user.id)
    .maybeSingle()

  const connection = access.allowed
    ? await getActiveShopifyConnectionForUser(supabase, user.id)
    : null

  const links = connection ? await listShopifyLinksForUser(supabase, user.id) : []
  const mappings =
    connection && access.allowed
      ? await listShopifySectionMappingsForUser(supabase, user.id, connection.id)
      : []

  return NextResponse.json({
    data: {
      configured: isShopifyConfigured(),
      access: access.allowed,
      profile: {
        shopify_connect_enabled: profile?.shopify_connect_enabled === true,
        is_shop: profile?.is_shop === true,
        shop_verified: profile?.shop_verified === true,
      },
      connection: connection ? toPublicShopifyConnection(connection) : null,
      linkedCount: links.length,
      mappings,
    },
  })
}
