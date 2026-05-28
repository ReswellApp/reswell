/** Fake Stripe checkout reference prefix for admin-seeded test purchases. */
export const ADMIN_TEST_ORDER_STRIPE_PREFIX = "admin_test_"

export function isAdminTestOrderStripeReference(
  stripeCheckoutSessionId: string | null | undefined,
): boolean {
  return (
    typeof stripeCheckoutSessionId === "string" &&
    stripeCheckoutSessionId.startsWith(ADMIN_TEST_ORDER_STRIPE_PREFIX)
  )
}

/** Supabase filter: only real marketplace sales (not admin test seeds). */
export const REAL_MARKETPLACE_SALES_FILTER = { is_admin_test: false } as const
