import { signupDateOfBirthSchema } from "@reswell/api-contract"

/** Query param on `/auth/callback` and Google sign-up handoff URLs. */
export const SIGNUP_DATE_OF_BIRTH_PARAM = "dob"

/** Short-lived browser cookie so same-tab OAuth still has the birthday if the query is stripped. */
export const SIGNUP_DATE_OF_BIRTH_COOKIE = "rw_signup_dob"

export function parseSignupDateOfBirthParam(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const parsed = signupDateOfBirthSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function persistSignupDateOfBirthCookie(iso: string): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${SIGNUP_DATE_OF_BIRTH_COOKIE}=${iso}; Path=/; Max-Age=600; SameSite=Lax${secure}`
}

export function signupDateOfBirthCookieClearOptions(): {
  path: string
  maxAge: number
} {
  return { path: "/", maxAge: 0 }
}
