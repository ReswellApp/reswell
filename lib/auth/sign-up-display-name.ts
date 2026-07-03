import { validateDisplayName } from "@/lib/display-name-validation"

const MIN_DISPLAY_NAME_LENGTH = 5

function firstGrapheme(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return [...trimmed][0] ?? ""
}

/**
 * Default public name when no username is chosen: last-name initial + first name (e.g. Doe + John → "DJohn").
 */
export function buildDefaultSignUpDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first || !last) return ""

  const lastInitial = firstGrapheme(last).toUpperCase()
  const primary = `${lastInitial}${first}`
  if (primary.length >= MIN_DISPLAY_NAME_LENGTH) return primary

  const compact = `${first}${last}`.replace(/\s+/g, "")
  if (compact.length >= MIN_DISPLAY_NAME_LENGTH) return compact

  return `${first} ${last}`.trim()
}

export type ResolveSignUpDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; error: string }

/** Username overrides the default; otherwise derive from first / last name. */
export function resolveSignUpDisplayName(args: {
  username?: string | null
  firstName: string
  lastName: string
  email?: string | null
}): ResolveSignUpDisplayNameResult {
  const trimmedUsername = args.username?.trim() ?? ""
  if (trimmedUsername) {
    const usernameCheck = validateDisplayName(trimmedUsername, args.email)
    if (!usernameCheck.valid) {
      return { ok: false, error: usernameCheck.error }
    }
    return { ok: true, displayName: trimmedUsername }
  }

  const displayName = buildDefaultSignUpDisplayName(args.firstName, args.lastName)
  const derivedCheck = validateDisplayName(displayName, args.email)
  if (!derivedCheck.valid) {
    return { ok: false, error: derivedCheck.error }
  }

  return { ok: true, displayName }
}
