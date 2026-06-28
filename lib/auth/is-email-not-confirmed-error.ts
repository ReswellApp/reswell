/** True when GoTrue rejected sign-in because the address is not confirmed yet. */
export function isEmailNotConfirmedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  if (code === "email_not_confirmed") return true
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase()
  return message.includes("email not confirmed")
}
