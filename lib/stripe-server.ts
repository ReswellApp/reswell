/**
 * @deprecated Prefer `import stripeClient from "@/lib/stripe-client"` for new code.
 */
export {
  default as stripeClient,
  getStripeOptional,
  isStripeConfigured,
} from "./stripe-client"

import { getStripeOptional } from "./stripe-client"

/** Same as {@link getStripeOptional} — kept for existing imports. */
export function getStripe() {
  return getStripeOptional()
}
