import type { User } from "@supabase/supabase-js"

/** First name for welcome copy (Google OAuth metadata). */
export function oauthWelcomeFirstName(user: User): string | null {
  const meta = user.user_metadata ?? {}
  const given =
    typeof meta.given_name === "string" ? meta.given_name.trim() : ""
  if (given) return given

  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    ""
  if (full) {
    const first = full.split(/\s+/).filter(Boolean)[0]
    if (first) return first
  }

  return null
}
