/** Full URL Supabase redirects to after a recovery email (`resetPasswordForEmail`). */
export function buildPasswordRecoveryCallbackUrl(origin: string): string {
  const base = origin.replace(/\/$/, "")
  const next = encodeURIComponent("/auth/update-password")
  return `${base}/auth/callback?next=${next}`
}
