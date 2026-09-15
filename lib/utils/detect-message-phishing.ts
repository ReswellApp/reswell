/**
 * Marketplace policy: block phishing and impersonation scams in DM text.
 * Targets fake "Reswell support" notices, short-link account verification lures, etc.
 */

const SUSPICIOUS_SHORT_LINK_DOMAINS =
  /\b(?:tinu\.be|bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd|cutt\.ly|ow\.ly|shorturl\.at|rebrand\.ly|bl\.ink)\b/i

const RESWELL_IMPERSONATION_PATTERN =
  /\b(?:system\s+notice\s+from\s+reswell|reswell\s+support\s+team|from\s+reswell\s+support)\b/i

const ACCOUNT_RESTRICTION_PHISHING_PATTERN =
  /\b(?:account\s+access\s+(?:has\s+been\s+)?temporarily\s+(?:restricted|blocked|limited)|temporarily\s+restricted\s+pending(?:\s+additional)?\s+verification)\b/i

const VERIFY_ACCOUNT_WITH_LINK_PATTERN =
  /\bverify\s+(?:your\s+)?(?:account|banking(?:\s+information)?)\b[\s\S]{0,400}\b(?:https?:\/\/|www\.|copy\s+and\s+paste\s+this\s+link)\b/i

const COPY_LINK_RESWELL_SCAM_PATTERN =
  /\bcopy\s+and\s+paste\s+this\s+link\b[\s\S]{0,200}\breswell\b/i

const RESWELL_SCAM_WITH_EXTERNAL_LINK_PATTERN =
  /\breswell\b[\s\S]{0,400}\b(?:https?:\/\/[^\s/]+\.(?:be|ly|gd|at|co)\/|tinu\.be\/)\S*/i

/** Fake “sale complete, confirm payout” blast (PORTAL_CONFIRM: evil.com/CODE). */
const PORTAL_CONFIRM_PATTERN = /\bportal[_\s-]?confirm\b/i

const CONFIRM_TOKEN_BARE_DOMAIN_PATTERN =
  /\b(?:portal|account|payment|bank(?:ing)?)[_\s-]?(?:confirm|verify|check)\s*:\s*[a-z0-9.-]+\.[a-z]{2,}\/\S+/i

const RESWELL_ITEM_SOLD_LURE_PATTERN = /\byour\s+reswell\s+item\s+has\s+been\s+sold\b/i

const PAYMENT_DETAILS_ACCOUNT_LURE_PATTERN =
  /\bpayment\s+details\s+linked\s+to\s+your\s+account\b/i

/** Broad SQL ilike pre-filters before running {@link messageAppearsToBePhishing}. */
export const PHISHING_MESSAGE_SQL_PREFILTER_PATTERNS = [
  "%tinu.be%",
  "%system notice from reswell%",
  "%reswell support team%",
  "%temporarily restricted pending%",
  "%copy and paste this link%",
  "%PORTAL_CONFIRM%",
  "%your RESWELL item has been sold%",
  "%payment details linked to your account%",
] as const

export function messageAppearsToBePhishing(text: string): boolean {
  const t = text.trim()
  if (!t) return false

  if (SUSPICIOUS_SHORT_LINK_DOMAINS.test(t)) return true
  if (RESWELL_IMPERSONATION_PATTERN.test(t)) return true
  if (ACCOUNT_RESTRICTION_PHISHING_PATTERN.test(t)) return true
  if (VERIFY_ACCOUNT_WITH_LINK_PATTERN.test(t)) return true
  if (COPY_LINK_RESWELL_SCAM_PATTERN.test(t)) return true
  if (RESWELL_SCAM_WITH_EXTERNAL_LINK_PATTERN.test(t)) return true
  if (PORTAL_CONFIRM_PATTERN.test(t)) return true
  if (CONFIRM_TOKEN_BARE_DOMAIN_PATTERN.test(t)) return true
  if (RESWELL_ITEM_SOLD_LURE_PATTERN.test(t)) return true
  if (PAYMENT_DETAILS_ACCOUNT_LURE_PATTERN.test(t)) return true

  return false
}
