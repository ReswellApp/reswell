import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbGetShopifyConnectionByDomain,
  toPublicShopifyConnection,
} from "@/lib/db/shopifyConnections"
import { shopifyLinkSkipsReinstall } from "@/lib/shopify/install-launch"
import type { PublicShopifyConnection } from "@/lib/shopify/types"

export type ShopifyEmbeddedHomeData = {
  shopDomain: string
  linked: boolean
  connection: PublicShopifyConnection | null
}

export async function getShopifyEmbeddedHomeData(
  shopDomain: string,
): Promise<ShopifyEmbeddedHomeData> {
  const serviceSupabase = createServiceRoleClient()
  try {
    const connection = await dbGetShopifyConnectionByDomain(
      serviceSupabase,
      shopDomain,
    )
    const linked = shopifyLinkSkipsReinstall(connection, null)
    return {
      shopDomain,
      linked,
      connection: connection ? toPublicShopifyConnection(connection) : null,
    }
  } catch (error) {
    console.error("[shopify] embedded home", { shopDomain, error })
    return { shopDomain, linked: false, connection: null }
  }
}
