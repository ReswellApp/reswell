/**
 * Base URL for absolute app links (e.g. redirects, emails).
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
 * Public site origin. Prefers `NEXT_PUBLIC_URL`, then the same fallbacks as {@link getCheckoutAppOrigin}.
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

/** True when origin host is local (localhost / loopback). */
export function originIsLocalhost(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl.includes("://") ? baseUrl : `https://${baseUrl}`)
    const h = u.hostname.toLowerCase()
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]"
  } catch {
    return false
  }
}
