/** Query flag appended after `/auth/recovery` (and legacy routes) so the client always opens the reset-password dialog. */
export const PASSWORD_RESET_QUERY_KEY = "password_reset"
export const PASSWORD_RESET_QUERY_VALUE = "1"

/** Path + query used after server-side recovery exchange. */
export function passwordResetLandingPath(): string {
  return `/?${PASSWORD_RESET_QUERY_KEY}=${PASSWORD_RESET_QUERY_VALUE}`
}
