/**
 * Marketplace policy: prohibit sharing phone-number-like payloads in DM text.
 * Heuristic matcher (NANP-heavy + unobfuscated spelled-digit words).
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

/** Replace spelled-out digits (whole words only) — e.g. "8zero54539406". */
function expandSpelledDigitWords(raw: string): string {
  return raw.replace(SPELLED_DIGIT_PATTERN, (word) => {
    const key = word.toLowerCase()
    return DIGIT_FROM_WORD[key] ?? ""
  })
}

/** True if parentheses contain ≥10 digits (e.g. "(8054549406)", "(949-689-0987)"). */
function parentheticalDenseDigitBlock(original: string): boolean {
  const re = /\(([^)]{0,64})\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(original)) !== null) {
    const inner = m[1] ?? ""
    const digits = inner.replace(/\D/g, "")
    if (digits.length >= 10) return true
  }
  return false
}

/** NANP-ish grouped forms: (949) 689-0987, 949-689-0987, 949.689.0987 */
function groupedNanpLike(original: string): boolean {
  return /\b(?:\+?\s*1\s*[\s.)-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(original)
}

/** International-style +1 with grouped remainder. */
function plusOneGrouped(original: string): boolean {
  return /\+\s*1\s*[().\s-]*\d{3}\s*[().\s-]*\d{3}\s*[().\s-]*\d{4}\b/.test(original.replace(/\s+/g, " "))
}

/** Any substring of exactly 10 digits bordered by non-digits or line edges. */
function isolatedTenDigit(original: string): boolean {
  return /(?:^|\D)(\d{10})(?:\D|$)/.test(original)
}

function expandedDigitScan(expandedFromSpelled: string): boolean {
  const digitsOnly = expandedFromSpelled.replace(/\D/g, "")
  return /\d{10}/.test(digitsOnly)
}

/**
 * Returns true when the message should not be delivered to the thread.
 */
export function messageAppearsToSharePhoneNumber(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (parentheticalDenseDigitBlock(t)) return true
  if (groupedNanpLike(t)) return true
  if (plusOneGrouped(t)) return true
  if (isolatedTenDigit(t)) return true

  const expanded = expandSpelledDigitWords(t)
  if (expandedDigitScan(expanded)) return true

  return false
}
