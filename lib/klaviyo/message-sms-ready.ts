/**
 * Whether a Message Sent event should claim SMS readiness for Klaviyo flow filters.
 * Opt-in alone is not enough — Klaviyo needs a resolvable E.164 US phone on the profile.
 */
export function isMessageSmsReady(input: {
  optedIn: boolean
  phoneE164: string | null | undefined
}): boolean {
  return input.optedIn === true && Boolean(input.phoneE164?.trim())
}
