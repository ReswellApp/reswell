/**
 * Base URL for Stripe Checkout success/cancel redirects.
 * Stripe requires an absolute URL with scheme (https:// or http://).
 */
export function getCheckoutAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const vercel = process.env.VERCEL_URL?.trim()

  let base =
    explicit ||
    (vercel ? `https://${vercel}` : "") ||
    "http://localhost:3000"

  base = base.replace(/\/$/, "")

  if (!/^https?:\/\//i.test(base)) {
    const host = base.replace(/^\/+/, "")
    const useHttp =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]")
    return `${useHttp ? "http" : "https"}://${host}`
  }

  return base
}
