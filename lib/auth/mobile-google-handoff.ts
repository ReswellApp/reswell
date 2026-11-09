const AUTHORIZE_PATH = "/auth/v1/authorize"

/**
 * The phone opens this URL before Google. iOS prints that host on the
 * sign-in sheet, so the handoff has to live on Reswell, not Supabase.
 */
export function mobileGoogleHandoffUrl(origin: string, authorizeUrl: string): string {
  const start = new URL("/api/mobile/v1/auth/google", origin)
  start.searchParams.set("url", authorizeUrl)
  return start.toString()
}

/** Allow only this project's Supabase Google authorize URL. */
export function mobileGoogleAuthorizeTarget(supabaseUrl: string, rawTarget: string): URL | null {
  let target: URL
  let allowed: URL
  try {
    target = new URL(rawTarget)
    allowed = new URL(supabaseUrl)
  } catch {
    return null
  }
  if (target.protocol !== "https:") return null
  if (target.hostname !== allowed.hostname) return null
  if (target.port) return null
  if (target.pathname !== AUTHORIZE_PATH) return null
  if (target.username || target.password) return null
  return target
}
