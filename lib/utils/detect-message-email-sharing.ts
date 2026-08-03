/**
 * Marketplace policy: prohibit sharing email addresses in DM text.
 * Matches direct addresses, common obfuscations (at/dot, spaced @),
 * and soliciting contact via the phrase "email address".
 */

const DIRECT_EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i

/** e.g. "name at gmail dot com", "name AT domain DOT com" */
const SPELLED_EMAIL_PATTERN =
  /\b[\w.+-]{1,64}\s+(?:at|AT)\s+[\w.-]{1,64}\s+(?:dot|DOT)\s+[\w.-]{2,24}\b/

/** e.g. "name @ gmail . com" with extra spaces */
const SPACED_EMAIL_PATTERN =
  /\b[\w.+-]{1,64}\s*@\s*[\w.-]{1,64}\s*\.\s*[\w.-]{2,24}\b/

/** Soliciting or discussing off-platform email contact */
const EMAIL_ADDRESS_PHRASE_PATTERN = /\be-?mail\s+address(?:es)?\b/i

export function messageAppearsToShareEmailAddress(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (DIRECT_EMAIL_PATTERN.test(t)) return true
  if (SPELLED_EMAIL_PATTERN.test(t)) return true
  if (SPACED_EMAIL_PATTERN.test(t)) return true
  if (EMAIL_ADDRESS_PHRASE_PATTERN.test(t)) return true

  return false
}
