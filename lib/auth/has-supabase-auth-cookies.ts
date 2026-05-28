type CookieLike = { name: string }

/** True when the request likely has a Supabase SSR session (chunked auth-token cookies). */
export function hasSupabaseAuthCookies(cookies: CookieLike[]): boolean {
  return cookies.some(
    ({ name }) => name.startsWith("sb-") && name.includes("auth-token"),
  )
}
