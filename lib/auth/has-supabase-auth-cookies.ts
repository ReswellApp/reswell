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

/** Remove Supabase SSR auth cookies from `document.cookie` (non-httpOnly chunks only). */
export function clearSupabaseAuthCookiesClient(): void {
  if (typeof document === "undefined") return
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0] ?? ""
    if (!name.startsWith("sb-") || !name.includes("auth-token")) continue
    document.cookie = `${name}=; path=/; max-age=0`
  }
}
