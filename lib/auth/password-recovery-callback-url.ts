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
