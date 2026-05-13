import Stripe from "stripe"

let stripe: Stripe | null = null

/**
 * Parse one or more webhook signing secrets from env (comma/newline-separated).
 * Strips accidental quotes from dashboard copy/paste.
 * During rotation Stripe may provide two secrets; listing both avoids 400s until env is narrowed to one.
 */
export function parseStripeWebhookSigningSecrets(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
}

/** Try each signing secret until `constructEvent` succeeds (rotation-safe). */
export function constructStripeWebhookEvent(
  rawBody: string,
  signature: string,
  secretsRaw: string,
): Stripe.Event {
  const segments = parseStripeWebhookSigningSecrets(secretsRaw)
  if (segments.length === 0) {
    throw new Error("No STRIPE_WEBHOOK_SECRET value after parsing")
  }
  const client = getStripe()
  let lastErr: unknown
  for (const secret of segments) {
    try {
      return client.webhooks.constructEvent(rawBody, signature, secret)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/**
 * Returns an error message if publishable + secret keys are not the same mode (test vs live).
 *
 * On Vercel, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is embedded at **build** time, while
 * `STRIPE_SECRET_KEY` is read at **runtime**. Updating only the secret (or only redeploying
 * part of the app) can leave the browser with a publishable key that does not match the
 * secret used to create PaymentIntents — Stripe.js then fails on `confirmPayment`.
 */
export function getStripeCheckoutKeyConfigError(): string | null {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
  const sk = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  if (!pk || !sk) {
    return "Stripe is not fully configured (missing publishable or secret key)."
  }
  const pkLive = pk.startsWith("pk_live_")
  const pkTest = pk.startsWith("pk_test_")
  const skLive = sk.startsWith("sk_live_")
  const skTest = sk.startsWith("sk_test_")
  if ((!pkLive && !pkTest) || (!skLive && !skTest)) {
    return "Stripe keys are not recognized (expected pk_live_/pk_test_ and sk_live_/sk_test_)."
  }
  if ((pkLive && skLive) || (pkTest && skTest)) {
    return null
  }
  return "Stripe publishable and secret keys must both be live or both test. Copy both from the same mode in the Stripe Dashboard, set them in Vercel for Production, then redeploy so the site rebuilds with the publishable key."
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  stripe ??= new Stripe(key)
  return stripe
}
