import type { SupabaseClient } from "@supabase/supabase-js"
import { markShopifyConnectionUninstalled } from "@/lib/db/shopify-connections"

/**
 * Shopify mandatory compliance + lifecycle webhooks.
 *
 * A public Shopify App MUST handle these topics (Shopify rejects/uninstalls apps that don't):
 *  - app/uninstalled        → token already revoked; pause our side
 *  - customers/data_request → GDPR: surface what customer data we hold (we hold none directly)
 *  - customers/redact       → GDPR: erase a customer's data
 *  - shop/redact            → GDPR: erase a shop's data (sent ~48h after uninstall)
 *
 * Reswell stores no Shopify *customer* PII — buyers are Reswell accounts and orders push
 * outward to Shopify. So data_request/customers redact are recorded as no-op acknowledgements;
 * shop/redact tears down the connection's residual data.
 */
export const SHOPIFY_COMPLIANCE_TOPICS = [
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const

export type ShopifyComplianceTopic = (typeof SHOPIFY_COMPLIANCE_TOPICS)[number]

export function isShopifyComplianceTopic(topic: string): topic is ShopifyComplianceTopic {
  return (SHOPIFY_COMPLIANCE_TOPICS as readonly string[]).includes(topic)
}

async function logComplianceEvent(
  serviceSupabase: SupabaseClient,
  shopDomain: string,
  topic: string,
  payload: unknown,
): Promise<void> {
  try {
    await serviceSupabase.from("shopify_compliance_events").insert({
      shop_domain: shopDomain,
      topic,
      payload: (payload ?? {}) as Record<string, unknown>,
    })
  } catch (e) {
    console.error("[shopify compliance] failed to log event", { shopDomain, topic, e })
  }
}

export async function handleShopifyComplianceWebhook(opts: {
  serviceSupabase: SupabaseClient
  shopDomain: string
  topic: ShopifyComplianceTopic
  payload: unknown
}): Promise<{ handled: true; action: string }> {
  const { serviceSupabase, shopDomain, topic, payload } = opts
  await logComplianceEvent(serviceSupabase, shopDomain, topic, payload)

  switch (topic) {
    case "app/uninstalled": {
      const result = await markShopifyConnectionUninstalled(serviceSupabase, shopDomain)
      return { handled: true, action: result ? "uninstalled" : "no_active_connection" }
    }

    case "shop/redact": {
      // Final teardown: remove residual connection + linked sync rows for the shop.
      await serviceSupabase
        .from("shopify_connections")
        .delete()
        .eq("shop_domain", shopDomain)
      return { handled: true, action: "shop_redacted" }
    }

    case "customers/data_request":
    case "customers/redact":
      // We hold no Shopify customer PII; acknowledge per Shopify requirements.
      return { handled: true, action: "acknowledged_no_data" }
  }
}
