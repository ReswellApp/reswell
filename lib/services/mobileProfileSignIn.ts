import type { MobileProfileEmail, MobileProfilePassword, MobileProfileSignInAction } from "@reswell/api-contract"
import { buildPasswordRecoveryCallbackUrl } from "@/lib/auth/password-recovery-callback-url"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import type { User } from "@supabase/supabase-js"

const EMAIL_PASSWORD_UNAVAILABLE =
  "You sign in with Google or another provider on this account. Use “Email reset link” below if you want to add or reset an email-and-password login."

export function profileHasEmailPassword(user: User): boolean {
  return user.identities?.some((identity) => identity.provider === "email") === true
}

export function profilePasswordChangeError(_status: number, payload: unknown): string {
  const message = gotrueMessage(payload).toLowerCase()
  if (
    message.includes("current password") ||
    message.includes("invalid login") ||
    message.includes("invalid_credentials")
  ) {
    return "Current password is incorrect."
  }
  if (message.includes("at least") || message.includes("too short") || message.includes("weak")) {
    return "Password must be at least 6 characters."
  }
  return "Couldn't update your password."
}

export async function changeMobileProfilePasswordService(
  user: User,
  accessToken: string,
  input: MobileProfilePassword,
): Promise<MobileApiResult<MobileProfileSignInAction>> {
  if (!profileHasEmailPassword(user)) {
    return { ok: false, status: 400, error: EMAIL_PASSWORD_UNAVAILABLE }
  }
  const email = user.email?.trim()
  if (!email) {
    return {
      ok: false,
      status: 400,
      error: "This account does not have an email on file. Change your password via the provider you signed up with.",
    }
  }
  const result = await gotrue(accessToken, "PUT", "user", {
    email,
    password: input.new_password,
    current_password: input.current_password,
  })
  if (!result.ok) return { ok: false, status: result.status, error: profilePasswordChangeError(result.status, result.payload) }
  return { ok: true, data: { ok: true } }
}

export async function sendMobileProfilePasswordResetService(
  user: User,
): Promise<MobileApiResult<MobileProfileSignInAction>> {
  const email = user.email?.trim()
  if (!email) {
    return {
      ok: false,
      status: 400,
      error: "This account does not have an email on file. Change your password via the provider you signed up with.",
    }
  }
  const redirectTo = buildPasswordRecoveryCallbackUrl(publicSiteOriginForEmail())
  const result = await gotrue(null, "POST", `recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email })
  if (!result.ok) return { ok: false, status: 400, error: "Couldn't send the reset email." }
  return { ok: true, data: { ok: true } }
}

export async function changeMobileProfileEmailService(
  user: User,
  accessToken: string,
  input: MobileProfileEmail,
): Promise<MobileApiResult<MobileProfileSignInAction>> {
  const current = user.email?.trim().toLowerCase() ?? ""
  if (input.email.trim().toLowerCase() === current) {
    return { ok: false, status: 400, error: "That's already your email." }
  }
  const result = await gotrue(accessToken, "PUT", "user", { email: input.email.trim() })
  if (!result.ok) return { ok: false, status: 400, error: "Couldn't update your email." }
  return { ok: true, data: { ok: true } }
}

function gotrueMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const row = payload as { msg?: unknown; message?: unknown; error_description?: unknown; error?: unknown; code?: unknown }
  return [row.msg, row.message, row.error_description, row.error, row.code].filter((value) => typeof value === "string").join(" ")
}

async function gotrue(
  accessToken: string | null,
  method: "PUT" | "POST",
  path: string,
  body: Record<string, string>,
): Promise<{ ok: true } | { ok: false; status: number; payload: unknown }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { ok: false, status: 500, payload: null }
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken ?? key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    console.error("[mobile-api] profile sign-in auth failed", {
      path: path.split("?")[0],
      status: response.status,
      timestamp: new Date().toISOString(),
    })
    return { ok: false, status: response.status, payload }
  }
  return { ok: true }
}
