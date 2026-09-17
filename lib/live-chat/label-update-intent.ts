/** Detect when the visitor is asking to fix a shipping label / ship-from address. */

const LABEL_UPDATE_INTENT =
  /\b(shipping\s*labels?|ship[\s-]?from|update\s+(?:\w+\s+){0,4}labels?|wrong\s+(from\s+)?address|reprint\s+(the\s+)?labels?|labels?\s+(is\s+|are\s+)?wrong|new\s+labels?|change\s+(the\s+)?(ship[\s-]?from|labels?))\b/i

export function isLiveChatShipFromLabelUpdateIntent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (LABEL_UPDATE_INTENT.test(trimmed)) return true
  // Common typos / near-misses: "on of my shipping labels", "udpate my label"
  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ")
  if (normalized.includes("shipping label") || normalized.includes("shiping label")) return true
  if (/\b(update|udpate|fix|change).{0,40}\blabels?\b/.test(normalized)) return true
  if (/\blabels?\b.{0,40}\b(update|udpate|fix|change|wrong|reprint)\b/.test(normalized)) return true
  return false
}

/** True if any visitor turn in the thread asked for a ship-from label update. */
export function threadHasLiveChatShipFromLabelUpdateIntent(
  messages: Array<{ sender_type: string; content: string }>,
): boolean {
  return messages.some(
    (message) =>
      message.sender_type === "visitor" && isLiveChatShipFromLabelUpdateIntent(message.content),
  )
}
