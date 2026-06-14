type CookieLike = { name: string }

/** True when the request likely has a Supabase SSR session (chunked auth-token cookies). */
export function hasSupabaseAuthCookies(cookies: CookieLike[]): boolean {
  return cookies.some(
    ({ name }) => name.startsWith("sb-") && name.includes("auth-token"),
  )
}

/** Browser equivalent — used before showing visitor-only UI (Safari, in-app browsers, etc.). */
export function hasSupabaseAuthCookiesClient(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((part) => {
    const name = part.trim().split("=")[0] ?? ""
    return name.startsWith("sb-") && name.includes("auth-token")
  })
}
