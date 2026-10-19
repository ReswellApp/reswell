const ACCOUNT_NOT_APPROVED = "Your account is not approved for Shopify yet."
const ALREADY_CLAIMED = "This Shopify install was already linked to a Reswell account."
const STORE_BLOCKED = "This Shopify store cannot be linked to this Reswell account."
const INSTALL_EXPIRED =
  "This Shopify install session has expired. Install again from Shopify."
const GENERIC = "Could not link this Shopify store. Try installing again from Shopify."

/**
 * Map claim failures the merchant can act on.
 * Match the account-approval exception only. "Shopify usage charge is not
 * approved" and other "not approved" errors are unrelated.
 */
export function publicShopifyClaimError(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (/reswell account is not approved for shopify/i.test(message)) {
    return ACCOUNT_NOT_APPROVED
  }
  if (/already claimed/i.test(message)) {
    return ALREADY_CLAIMED
  }
  if (/belongs to another/i.test(message) || /linked to another/i.test(message)) {
    return STORE_BLOCKED
  }
  if (/not ready|expired|not found/i.test(message)) {
    return INSTALL_EXPIRED
  }
  return GENERIC
}
