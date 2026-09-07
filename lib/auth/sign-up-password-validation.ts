export type SignUpPasswordResult = { valid: true } | { valid: false; error: string }

export const SIGN_UP_PASSWORD_HINT =
  "12+ chars, upper, lower, number, and special character."

export function validateSignUpPassword(password: string): SignUpPasswordResult {
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters." }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must include at least one uppercase letter." }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must include at least one lowercase letter." }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must include at least one number." }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must include at least one special character." }
  }
  return { valid: true }
}
