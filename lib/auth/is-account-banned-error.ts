/** True when GoTrue rejected sign-in because the account is banned. */
export function isAccountBannedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  if (code === "user_banned") return true
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase()
  return message.includes("user is banned") || message.includes("user_banned")
}
