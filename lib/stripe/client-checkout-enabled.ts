/** Client-safe Stripe checkout env — no `@stripe/*` imports (keeps initial bundles small). */
export function stripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
}

export function stripeCardCheckoutEnabled(): boolean {
  return Boolean(stripePublishableKey())
}
