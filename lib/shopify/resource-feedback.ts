/**
 * Shopify ResourceFeedback message rules (sales channel 5.7.3):
 * - start with a capital letter (not all caps)
 * - end with a period
 * - max 100 characters
 * - up to 10 messages
 */
export function formatShopifyFeedbackMessage(raw: string): string | null {
  let message = raw.trim().replace(/\s+/g, " ")
  if (!message) return null
  if (!/[.!?]$/.test(message)) message = `${message}.`
  message = message.charAt(0).toUpperCase() + message.slice(1)
  if (message.length > 100) {
    message = `${message.slice(0, 99).replace(/\s+\S*$/, "").trimEnd()}.`
  }
  if (message.length > 100 || message.length < 2) return null
  if (message === message.toUpperCase()) return null
  return message
}

export function shopifyFeedbackMessages(rawMessages: string[]): string[] {
  const out: string[] = []
  for (const raw of rawMessages) {
    const formatted = formatShopifyFeedbackMessage(raw)
    if (!formatted) continue
    if (out.includes(formatted)) continue
    out.push(formatted)
    if (out.length >= 10) break
  }
  return out
}

export type ShopifyProductFeedbackState = "REQUIRES_ACTION" | "ACCEPTED"

export function shopifyOrderAttributionSourceName(
  channelHandle: string | null | undefined,
): string | null {
  const handle = channelHandle?.trim()
  if (!handle) return null
  return handle.startsWith("channel:") ? handle : `channel:${handle}`
}
