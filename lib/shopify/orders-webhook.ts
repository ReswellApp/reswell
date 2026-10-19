/** Shopify rejects ORDERS_CREATE until protected customer data is approved. */
export function isShopifyOrdersWebhookRejection(message: string): boolean {
  return /protected customer data/i.test(message)
}
