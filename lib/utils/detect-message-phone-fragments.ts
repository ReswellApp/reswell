/**
 * Marketplace policy: catch phone numbers split across consecutive DMs
 * (e.g. "843" → "997" → "5252"). Each fragment alone passes the single-message
 * detector, so we evaluate the concatenation of the sender's trailing run of
 * digit-only messages.
 */

const SPELLED_DIGIT_PATTERN = /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi

const DIGIT_FROM_WORD: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
}

function expandSpelledDigitWords(raw: string): string {
  return raw.replace(SPELLED_DIGIT_PATTERN, (word) => DIGIT_FROM_WORD[word.toLowerCase()] ?? "")
}

/**
 * True when the message is nothing but a short digit chunk (optionally with
 * phone separators or spelled-out digits) — a plausible piece of a split-up
 * phone number. Fewer than 10 digits, since ≥10 is caught by the
 * single-message detector.
 */
export function messageIsPhoneNumberFragmentCandidate(text: string): boolean {
  const expanded = expandSpelledDigitWords(text).trim()
  if (!expanded) return false
  if (/[^\d\s().+-]/.test(expanded)) return false
  const digits = expanded.replace(/\D/g, "")
  return digits.length >= 1 && digits.length <= 9
}

/** Digits-only payload of a fragment candidate. */
export function fragmentDigits(text: string): string {
  return expandSpelledDigitWords(text).replace(/\D/g, "")
}

/**
 * `priorFragments` are the sender's immediately preceding digit-only messages
 * in the same conversation, ordered oldest → newest. Returns true when some
 * contiguous run ending at `newFragment` concatenates to a NANP-length phone
 * number (10 digits, or 11 with a leading 1).
 */
export function fragmentsCombineIntoPhoneNumber(
  priorFragments: string[],
  newFragment: string,
): boolean {
  if (!messageIsPhoneNumberFragmentCandidate(newFragment)) return false

  let combined = fragmentDigits(newFragment)
  if (isPhoneLengthDigitRun(combined)) return true

  for (let i = priorFragments.length - 1; i >= 0; i--) {
    const prior = priorFragments[i]
    if (!messageIsPhoneNumberFragmentCandidate(prior)) break
    combined = fragmentDigits(prior) + combined
    if (isPhoneLengthDigitRun(combined)) return true
    if (combined.length > 11) return false
  }

  return false
}

function isPhoneLengthDigitRun(digits: string): boolean {
  if (digits.length === 10) return true
  if (digits.length === 11 && digits.startsWith("1")) return true
  return false
}
