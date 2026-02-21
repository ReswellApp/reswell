/**
 * Display name validation: no profanity, no email.
 * Use at sign-up and when updating profile so usernames never expose personal info or inappropriate content.
 */

/** Words that are not allowed in display names (lowercase, whole-word match). */
const BLOCKLIST = [
  "ass", "asses", "bastard", "bitch", "bitches", "bullshit", "crap", "damn",
  "dick", "dicks", "fuck", "fucked", "fucker", "fucking", "hell", "shit",
  "shitty", "slut", "sluts", "whore", "whores", "wtf", "piss", "pissed",
  "cock", "cunt", "dumbass", "asshole", "dipshit", "dipstick", "jackass",
  "retard", "retarded", "fag", "faggot", "nigger", "nigga", "nazi",
]

const MIN_LENGTH = 2
const MAX_LENGTH = 50

/** Basic email pattern: something@something */
const EMAIL_LIKE = /@|\.(com|net|org|io|co|edu|gov)(\s|$)/i

export type DisplayNameResult = { valid: true } | { valid: false; error: string }

/**
 * Validates a display name: length, no @, no email-like value, no profanity.
 * Pass userEmail when available to reject the user's own email as their name.
 */
export function validateDisplayName(
  name: string | null | undefined,
  userEmail?: string | null
): DisplayNameResult {
  const trimmed = name?.trim()
  if (!trimmed) {
    return { valid: false, error: "Display name is required." }
  }
  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: `Display name must be at least ${MIN_LENGTH} characters.` }
  }
  if (trimmed.length > MAX_LENGTH) {
    return { valid: false, error: `Display name must be ${MAX_LENGTH} characters or less.` }
  }
  if (trimmed.includes("@")) {
    return { valid: false, error: "Display name cannot contain @ (use a username, not your email)." }
  }
  if (EMAIL_LIKE.test(trimmed)) {
    return { valid: false, error: "Display name cannot be an email address." }
  }
  if (userEmail && trimmed.toLowerCase() === userEmail.toLowerCase()) {
    return { valid: false, error: "Display name cannot be your email address." }
  }
  const lower = trimmed.toLowerCase()
  const hasBlocked = BLOCKLIST.some((word) => {
    const re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i")
    return re.test(lower)
  })
  if (hasBlocked) {
    return { valid: false, error: "Please choose a different display name." }
  }
  return { valid: true }
}
