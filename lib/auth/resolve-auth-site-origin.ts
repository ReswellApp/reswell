/**
 * Origin used for Supabase auth `redirectTo` links (recovery, confirm, OAuth).
 * In local dev, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` can point at localhost when
 * the app is reached via a tunnel or alternate host.
 */
export function resolveAuthSiteOrigin(fallbackOrigin: string): string {
  let siteOrigin = fallbackOrigin.replace(/\/$/, "")
  const devOverride = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.trim()
  if (devOverride && process.env.NODE_ENV === "development") {
    try {
      const u = new URL(devOverride.startsWith("http") ? devOverride : `https://${devOverride}`)
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        siteOrigin = `${u.protocol}//${u.host}`
      }
    } catch {
      /* keep fallbackOrigin */
    }
  }
  return siteOrigin
}
