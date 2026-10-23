import { isShopifyOrdersWebhookRejection } from "@/lib/shopify/orders-webhook"

export type ShopifyConnectErrorDetail =
  | "invalid_shop"
  | "already_linked"
  | "store_taken"
  | "not_approved"
  | "unavailable"
  | "start_failed"
  | "invalid_callback"
  | "missing_callback_fields"
  | "invalid_state"
  | "shop_mismatch"
  | "connection_failed"

const MESSAGES: Record<ShopifyConnectErrorDetail, string> = {
  invalid_shop:
    "Enter your store's permanent your-store.myshopify.com domain, not a custom domain.",
  already_linked:
    "This Reswell account is already linked to a different Shopify store. Disconnect it first.",
  store_taken:
    "This Shopify store is already linked to a different Reswell account.",
  not_approved: "Your account is not approved for Shopify yet.",
  unavailable: "Shopify connections are temporarily unavailable. Try again shortly.",
  start_failed: "Reswell could not start the Shopify approval. Try again.",
  invalid_callback:
    "Shopify's response could not be verified. Start the connection again from this page.",
  missing_callback_fields:
    "Shopify's response was incomplete. Start the connection again from this page.",
  invalid_state:
    "The Shopify approval expired or was already used. Start the connection again from this page.",
  shop_mismatch:
    "Shopify returned a different store than the one you entered. Start again with the correct domain.",
  connection_failed:
    "Shopify approved the app, but Reswell could not finish linking the store. Try again.",
}

const GENERIC = "The Shopify connection could not be completed. Try connecting again."

export function shopifyConnectErrorMessage(detail: string | null | undefined): string {
  if (detail && Object.hasOwn(MESSAGES, detail)) {
    return MESSAGES[detail as ShopifyConnectErrorDetail]
  }
  return GENERIC
}

export type ShopifyOAuthCallbackOutcome =
  | { connected: true }
  | { connected: false; detail: ShopifyConnectErrorDetail }

/** Account OAuth callback. An orders-webhook rejection still linked the store. */
export function shopifyOAuthCallbackOutcome(
  message: string,
): ShopifyOAuthCallbackOutcome {
  if (isShopifyOrdersWebhookRejection(message)) return { connected: true }
  if (message.includes("different Reswell account")) {
    return { connected: false, detail: "store_taken" }
  }
  if (message.includes("different Shopify store")) {
    return { connected: false, detail: "already_linked" }
  }
  return { connected: false, detail: "connection_failed" }
}

/**
 * The connection_failed banner means the store was not linked.
 * A store that already has a catalog or a prior sync is linked.
 */
export function shopifyDashboardCallbackError(input: {
  errorFlag: string | null | undefined
  detail: string | null | undefined
  connection: {
    status: string
    last_webhook_at: string | null
    last_reconciled_at: string | null
  } | null
  catalogTotal: number
}): string | null {
  if (input.errorFlag !== "1") return null
  const linked =
    input.connection != null &&
    input.connection.status !== "disconnected" &&
    (input.catalogTotal > 0 ||
      Boolean(input.connection.last_webhook_at) ||
      Boolean(input.connection.last_reconciled_at))
  if (input.detail === "connection_failed" && linked) return null
  return shopifyConnectErrorMessage(input.detail)
}
