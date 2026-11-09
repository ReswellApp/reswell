import { pathnameRequiresAuthSession } from "@/lib/auth/pathname-requires-auth-session"
import { isShopifyClaimPath } from "@/lib/shopify/claim-path"

/**
 * After password (or other client) sign-in, soft `router.push` can remount a
 * sign-in screen before HTTP cookies are visible to RSC/middleware. That loop
 * shows as an infinite spinner — Shopify App Review hit this on /shopify/connect.
 *
 * Protected routes already hard-navigate. Shopify claim/connect must too: they
 * stay public for guests, but post-login they need a full document request.
 */
export function clientAuthRequiresHardNavigation(pathname: string): boolean {
  return pathnameRequiresAuthSession(pathname) || isShopifyClaimPath(pathname)
}
