/**
 * Cheap suspicion heuristics for contact/payment evasion that regex may miss.
 * Hits are not blocked on their own — they only trigger the fraud LLM.
 */

const CONTACT_SOLICIT_PATTERN =
  /\b(?:text|txt|call|ring|whatsapp|i\s*message|imessage|telegram|kik|discord)\s+(?:me|ya|you)\b/i

const CONTACT_CHANNEL_PATTERN =
  /\b(?:on\s+whatsapp|whats\s*app\s+me|on\s+telegram|telegram\s+me|on\s+signal|signal\s+me)\b/i

const DIGITS_PHRASE_PATTERN =
  /\b(?:my|the)\s+(?:number|digits|cell|phone|#)\b|\bhit\s+me\s+up\b|\bdm\s+me\s+(?:your|the)\s+(?:number|digits|#)\b/i

const SPELLED_DIGIT_RUN_PATTERN =
  /(?:\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b[\s,.-]*){4,}/i

const LEET_PAYMENT_PATTERN =
  /\b(?:v[e3]nm[o0]|z[e3]ll[e3]|p[a4@]yp[a4@]l|c[a4@]sh\s*app|w[e3]st[e3]rn\s*un[i1][o0]n)\b/i

const SPACED_PAYMENT_PATTERN =
  /\bv\s*e\s*n\s*m\s*o\b|\bz\s*e\s*l\s*l\s*e\b|\bp\s*a\s*y\s*p\s*a\s*l\b|\bc\s*a\s*s\s*h\s*a\s*p\s*p\b/i

const OFF_APP_PAY_PATTERN =
  /\b(?:pay|send|venmo|zelle|cash)\s+(?:me\s+)?(?:outside|off(?:\s*|-)?(?:app|platform|reswell)|instead)\b/i

const CASHAPP_HANDLE_PATTERN = /(?:^|[^\w$])\$[a-z][a-z0-9._]{2,20}\b/i

export function messageLooksLikeFraudEvasion(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (CONTACT_SOLICIT_PATTERN.test(t)) return true
  if (CONTACT_CHANNEL_PATTERN.test(t)) return true
  if (DIGITS_PHRASE_PATTERN.test(t)) return true
  if (SPELLED_DIGIT_RUN_PATTERN.test(t)) return true
  if (LEET_PAYMENT_PATTERN.test(t)) return true
  if (SPACED_PAYMENT_PATTERN.test(t)) return true
  if (OFF_APP_PAY_PATTERN.test(t)) return true
  if (CASHAPP_HANDLE_PATTERN.test(t)) return true

  return false
}
