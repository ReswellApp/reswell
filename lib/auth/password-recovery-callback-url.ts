/**
 * `redirect_to` for `resetPasswordForEmail`.
 * Use this path-only URL so Supabase “Redirect URLs” allowlists reliably match (`/auth/callback?next=` is easier to mismatch).
 *
 * Dashboard: add `https://<your-domain>/auth/recovery` (and localhost variants) → Authentication → URL Configuration.
 */
export function buildPasswordRecoveryCallbackUrl(origin: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}/auth/recovery`
}

/**
 * Link for Klaviyo / custom email providers after `auth.admin.generateLink` (recovery).
 * Uses `token_hash` + `type=recovery` so `/auth/recovery` can call `verifyOtp` server-side.
 * Do not use `properties.action_link` — it often redirects with a PKCE `code` that cannot
 * be exchanged from a cold email click (no code verifier in the browser).
 */
export function buildPasswordRecoveryEmailUrl(
  recoveryCallbackUrl: string,
  hashedToken: string,
): string {
  const base = recoveryCallbackUrl.replace(/\/$/, "")
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: "recovery",
  })
  return `${base}?${params.toString()}`
}
