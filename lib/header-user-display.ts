import type { User as SupabaseUser } from "@supabase/supabase-js"

/**
 * Display name for the header: profile (trimmed), then OAuth full_name, then email local part, then "User".
 */
export function headerDisplayName(
  profileDisplayName: string | null | undefined,
  user: SupabaseUser,
): string {
  const fromProfile = profileDisplayName?.trim()
  if (fromProfile) return fromProfile
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fullName = typeof meta?.full_name === "string" ? meta.full_name.trim() : ""
  if (fullName) return fullName
  const local = user.email?.split("@")[0]?.trim()
  if (local) return local
  return "User"
}

/**
 * First letter for avatar fallback: first Unicode letter in the label, else first grapheme, else "?".
 */
export function headerInitialFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim()
  if (!trimmed) return "?"
  const letterMatch = trimmed.match(/\p{L}/u)
  if (letterMatch) return letterMatch[0].toUpperCase()
  const first = [...trimmed][0]
  return first ? first.toUpperCase() : "?"
}
