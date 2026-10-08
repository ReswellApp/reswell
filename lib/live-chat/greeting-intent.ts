/**
 * Presence and greeting-only visitor turns.
 * “Hi there. anything there?” is a ping — not a product ask.
 * Pure — safe for node:test without path aliases.
 */

export function normalizeLiveChatVisitorText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const GREETING_ONLY =
  /^(?:hi|hello|hey|yo|hiya|howdy|sup|whats? up|good morning|good afternoon|good evening)(?: there)?$/

const PRESENCE_PING =
  /^(?:(?:hi|hello|hey|yo)(?: there)? )?(?:(?:is|are) )?(?:there )?(?:anyone|anybody|someone|you|anything) (?:there|here|around)$/

/** True when they are only checking if someone is here — no product question. */
export function isLiveChatPresenceIntent(text: string): boolean {
  const normalized = normalizeLiveChatVisitorText(text)
  if (!normalized) return false
  return GREETING_ONLY.test(normalized) || PRESENCE_PING.test(normalized)
}

/** @deprecated Use {@link isLiveChatPresenceIntent}. */
export function isLiveChatGreetingIntent(text: string): boolean {
  return isLiveChatPresenceIntent(text)
}
