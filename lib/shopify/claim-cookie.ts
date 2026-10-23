export const SHOPIFY_CLAIM_COOKIE = "reswell_shopify_claim"

/** Pending installs expire after 30 minutes; keep the cookie aligned. */
export const SHOPIFY_CLAIM_COOKIE_MAX_AGE_SECONDS = 30 * 60

export function shopifyClaimCookieOptions(claimSecret: string) {
  return {
    name: SHOPIFY_CLAIM_COOKIE,
    value: claimSecret,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SHOPIFY_CLAIM_COOKIE_MAX_AGE_SECONDS,
  }
}
