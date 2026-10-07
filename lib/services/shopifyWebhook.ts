import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbGetShopifyConnectionByDomain } from "@/lib/db/shopifyConnections"
import { dbInsertShopifyWebhookEvent } from "@/lib/db/shopifyQueue"

export async function ingestShopifyWebhook(input: {
  shopDomain: string
  webhookId: string
  topic: string
  payload: Record<string, unknown>
}): Promise<"inserted" | "duplicate"> {
  const serviceSupabase = createServiceRoleClient()
  const connection = await dbGetShopifyConnectionByDomain(
    serviceSupabase,
    input.shopDomain,
  )
  return dbInsertShopifyWebhookEvent(serviceSupabase, {
    connectionId: connection?.id ?? null,
    ...input,
  })
}
