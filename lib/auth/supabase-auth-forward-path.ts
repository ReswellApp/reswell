/**
 * Supabase sometimes lands auth params (`token_hash`, `code`) on the Site URL or another page.
 * Returns the auth handler that should receive them, or null when the request stays put.
 *
 * API routes never forward: Shopify and PayPal OAuth callbacks also carry `code`, and
 * sending it to `/auth/callback` makes Supabase try to exchange a non-Supabase code.
 */
export function supabaseAuthForwardPathname(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname.startsWith("/api/")) return null

  const tokenHash = searchParams.get("token_hash")
  const tokenType = searchParams.get("type")
  if (
    tokenHash &&
    tokenType &&
    pathname !== "/auth/callback" &&
    pathname !== "/auth/confirm" &&
    pathname !== "/auth/recovery"
  ) {
    if (tokenType === "recovery") return "/auth/recovery"
    if (tokenType === "email" || tokenType === "signup" || tokenType === "invite") {
      return "/auth/confirm"
    }
    return "/auth/callback"
  }

  if (
    pathname !== "/auth/callback" &&
    pathname !== "/auth/recovery" &&
    searchParams.has("code")
  ) {
    return tokenType === "recovery" ? "/auth/recovery" : "/auth/callback"
  }

  return null
}
