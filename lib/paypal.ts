import paypalSdk from "@paypal/payouts-sdk"

/**
 * IMPORTANT: PayPal Payouts API requires manual approval
 * from PayPal for your business account. Apply at:
 * https://developer.paypal.com/docs/payouts/
 *
 * Until approved, use Sandbox mode for testing:
 * PAYPAL_MODE=sandbox in .env.local
 *
 * Reswell's PayPal business account must have sufficient
 * balance to cover payouts. Monitor balance regularly.
 * Top up from Stripe → PayPal transfer as needed.
 */

function requirePayPalEnv(): { clientId: string; clientSecret: string; live: boolean } {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET")
  }
  const live = process.env.PAYPAL_MODE?.trim() === "live"
  return { clientId, clientSecret, live }
}

let cachedClient: InstanceType<typeof paypalSdk.core.PayPalHttpClient> | null = null

export function getPayPalHttpClient(): InstanceType<typeof paypalSdk.core.PayPalHttpClient> {
  if (cachedClient) return cachedClient
  const { clientId, clientSecret, live } = requirePayPalEnv()
  const environment = live
    ? new paypalSdk.core.LiveEnvironment(clientId, clientSecret)
    : new paypalSdk.core.SandboxEnvironment(clientId, clientSecret)
  cachedClient = new paypalSdk.core.PayPalHttpClient(environment)
  return cachedClient
}

export { paypalSdk }
