/**
 * One-off: register hostnames for Apple Pay / Link in Stripe (live or test, per your STRIPE_SECRET_KEY).
 *
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/register-stripe-payment-method-domains.cjs reswell.com www.reswell.com
 *
 * `www` is a separate hostname — add every origin users actually load (and preview URLs if you test on them).
 */
const Stripe = require("stripe")

function normalizeHost(input) {
  return String(input)
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .trim()
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY")
    process.exit(1)
  }
  const hosts = process.argv.slice(2).map(normalizeHost).filter(Boolean)
  if (!hosts.length) {
    console.error("Usage: STRIPE_SECRET_KEY=sk_... node scripts/register-stripe-payment-method-domains.cjs <domain> [domain ...]")
    process.exit(1)
  }

  const stripe = new Stripe(key)
  for (const domain_name of hosts) {
    try {
      const created = await stripe.paymentMethodDomains.create({ domain_name })
      console.log("created", domain_name, created.id)
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? e.message : String(e)
      console.error("error", domain_name, msg)
    }
  }
}

main()
