/** Dedicated route for choosing a new password after email recovery. */
export const UPDATE_PASSWORD_PATH = "/auth/update-password"

/** @deprecated Legacy homepage modal query — middleware redirects to {@link UPDATE_PASSWORD_PATH}. */
export const PASSWORD_RESET_QUERY_KEY = "password_reset"
/** @deprecated */
export const PASSWORD_RESET_QUERY_VALUE = "1"

/** Post-recovery redirect after server-side OTP exchange (`/auth/recovery`, `/auth/callback`). */
export function passwordResetLandingPath(): string {
  return UPDATE_PASSWORD_PATH
}
