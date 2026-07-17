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

/** Broad SQL ilike pre-filters before running {@link messageAppearsToBePhishing}. */
export const PHISHING_MESSAGE_SQL_PREFILTER_PATTERNS = [
  "%tinu.be%",
  "%system notice from reswell%",
  "%reswell support team%",
  "%temporarily restricted pending%",
  "%copy and paste this link%",
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

  return false
}
