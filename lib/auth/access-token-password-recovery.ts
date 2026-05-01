/**
 * Detects Gotrue JWTs minted during the password-reset / recovery exchange.
 * PKCE recovery completes with `SIGNED_IN` (not `PASSWORD_RECOVERY`) when the exchange
 * runs from the URL hash/query on the site's root — we use this so users still reach
 * `/auth/update-password` when Supabase falls back to the project Site URL.
 */
export function accessTokenIndicatesPasswordRecovery(accessToken: string | null | undefined): boolean {
  if (!accessToken?.includes(".")) return false
  try {
    const [, b64] = accessToken.split(".")
    if (!b64) return false

    let json: string
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(b64, "base64url").toString("utf8")
    } else if (typeof atob !== "undefined") {
      const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=").replace(/-/g, "+").replace(/_/g, "/")
      json = decodeURIComponent(
        [...atob(padded)].map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(""),
      )
    } else {
      return false
    }

    const payload = JSON.parse(json) as Record<string, unknown>
    const { amr } = payload

    if (payload.recovery_session === true || payload.recovery_pending === true) return true

    if (
      payload.recovery === true ||
      payload.is_recovery === true ||
      payload.password_recovery === true
    ) {
      return true
    }

    const checkMethodRec = (m: unknown) => {
      if (m === "recovery") return true
      if (typeof m !== "object" || m === null) return false
      if ("method" in m && (m as { method?: unknown }).method === "recovery") return true
      if (
        "authentication_method" in m &&
        (m as { authentication_method?: unknown }).authentication_method === "recovery"
      ) {
        return true
      }
      return false
    }

    return Array.isArray(amr) && amr.some(checkMethodRec)
  } catch {
    return false
  }
}
