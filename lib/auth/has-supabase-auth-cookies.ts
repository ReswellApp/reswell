type CookieLike = { name: string }

/**
 * Attributes that match `@supabase/ssr` session cookies (`Path=/`, `SameSite=Lax`).
 * `Expires` is required: `Max-Age=0` alone is dropped when a Set-Cookie header is
 * parsed again, which leaves an empty session cookie and the header still looks signed in.
 */
export const SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES =
  "path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax"

function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith("sb-") && name.includes("auth-token")
}

/** True when the request likely has a Supabase SSR session (chunked auth-token cookies). */
export function hasSupabaseAuthCookies(cookies: CookieLike[]): boolean {
  return cookies.some(({ name }) => isSupabaseAuthCookieName(name))
}

/** Browser equivalent — used before showing visitor-only UI (Safari, in-app browsers, etc.). */
export function hasSupabaseAuthCookiesClient(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((part) => {
    const trimmed = part.trim()
    if (!trimmed) return false
    const eq = trimmed.indexOf("=")
    const name = eq === -1 ? trimmed : trimmed.slice(0, eq)
    const value = eq === -1 ? "" : trimmed.slice(eq + 1)
    // An empty name left behind by a failed deletion is not a session.
    return isSupabaseAuthCookieName(name) && value.length > 0
  })
}

/** Remove Supabase SSR auth cookies from `document.cookie` (non-httpOnly chunks only). */
export function clearSupabaseAuthCookiesClient(): void {
  if (typeof document === "undefined") return
  const names: string[] = []
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0] ?? ""
    if (!isSupabaseAuthCookieName(name)) continue
    names.push(name)
  }
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
  for (const name of names) {
    document.cookie = `${name}=; ${SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES}`
    if (secure) {
      document.cookie = `${name}=; ${SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES}; secure`
    }
  }
}
