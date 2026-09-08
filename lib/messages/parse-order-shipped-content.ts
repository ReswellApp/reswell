export type ParsedOrderShippedContent = {
  orderNum: string | null
  listingTitle: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
}

function parseTrackingNumber(text: string): string | null {
  const labeled = text.match(/tracking\s*#?\s*:\s*([A-Z0-9]+)/i)
  if (labeled?.[1]) return labeled[1].trim()
  return text.match(/^tracking\s+([A-Z0-9]{6,})\b/im)?.[1]?.trim() || null
}

function parseTrackingCarrier(text: string): string | null {
  const labeled = text.match(/^carrier:\s*(.+)$/im)?.[1]?.trim() || null
  if (labeled) return labeled
  return text.match(/^tracking\s+[A-Z0-9]{6,}\s+·\s+(.+)$/im)?.[1]?.trim() || null
}

function looksLikeOrderShippedContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (/^your order shipped\b/i.test(trimmed)) return true
  if (/^shipped\s+[—–-]\s*tracking for/i.test(trimmed)) return true
  return false
}

export function parseOrderShippedMessageContent(
  content: string,
): ParsedOrderShippedContent | null {
  if (!looksLikeOrderShippedContent(content)) return null

  const trimmed = content.trim()
  const quotedTitle = trimmed.match(/tracking for\s+"([^"]+)"/i)?.[1]?.trim()
  const emDashTitle = trimmed.match(/^your order shipped\s+[—–-]\s*(.+)$/im)?.[1]?.trim()
  const listingTitle = quotedTitle || emDashTitle || null

  return {
    orderNum: trimmed.match(/order\s*#\s*([A-Za-z0-9]+)/i)?.[1]?.trim() || null,
    listingTitle,
    trackingNumber: parseTrackingNumber(trimmed),
    trackingCarrier: parseTrackingCarrier(trimmed),
  }
}
