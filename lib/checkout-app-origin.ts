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

/**
 * Public site origin for Stripe Connect onboarding (refresh/return).
 * Prefers `NEXT_PUBLIC_URL`, then the same fallbacks as {@link getCheckoutAppOrigin}.
 */
export function getPublicAppOrigin(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_URL?.trim()
  if (explicitUrl) {
    let base = explicitUrl.replace(/\/$/, "")
    if (!/^https?:\/\//i.test(base)) {
      const host = base.replace(/^\/+/, "")
      const useHttp =
        host.startsWith("localhost") ||
        host.startsWith("127.0.0.1") ||
        host.startsWith("[::1]")
      base = `${useHttp ? "http" : "https"}://${host}`
    }
    return base
  }
  return getCheckoutAppOrigin()
}

/** True when origin host is local (Stripe only allows this with test-mode keys). */
export function originIsLocalhost(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl.includes("://") ? baseUrl : `https://${baseUrl}`)
    const h = u.hostname.toLowerCase()
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]"
  } catch {
    return false
  }
}

export function stripeSecretKeyIsLiveMode(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live"))
}
