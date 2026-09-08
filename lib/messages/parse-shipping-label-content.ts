export type ParsedShippingLabelContent = {
  source: "reswell" | "admin"
  orderNum: string | null
  listingTitle: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
  hasPaperlessQr: boolean
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

function httpUrlOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

function looksLikeShippingLabelContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (/^shipping label ready\b/i.test(trimmed)) return true
  if (/shipping label ready for order/i.test(trimmed)) return true
  if (/shipping materials for order/i.test(trimmed)) return true
  return false
}

export function parseShippingLabelMessageContent(
  content: string,
): ParsedShippingLabelContent | null {
  if (!looksLikeShippingLabelContent(content)) return null

  const trimmed = content.trim()
  const isAdmin =
    /reswell\s*\(admin\)/i.test(trimmed) || /shipping materials for order/i.test(trimmed)
  const orderNum = trimmed.match(/order\s*#\s*([A-Za-z0-9]+)/i)?.[1]?.trim() || null

  const firstLine = trimmed.split("\n")[0] ?? ""
  const afterDash = firstLine.split(/[—–]/).slice(1).join("—").trim()
  let listingTitle: string | null = null
  if (afterDash && !/^order\s*#/i.test(afterDash)) {
    listingTitle = afterDash
  } else {
    const second = trimmed
      .split("\n")
      .map((l) => l.trim())
      .find((l, idx) => idx > 0 && l && !/^(tracking|carrier|label)\b/i.test(l))
    listingTitle = second || null
  }

  const labelFromLine = trimmed.match(/label\s*\(pdf\):\s*(\S+)/i)?.[1]
  const labelFromHost = trimmed.match(/https?:\/\/\S*shipengine\S+/i)?.[0]
  const labelPdfUrl = httpUrlOrNull(labelFromLine) ?? httpUrlOrNull(labelFromHost)

  return {
    source: isAdmin ? "admin" : "reswell",
    orderNum,
    listingTitle,
    trackingNumber: parseTrackingNumber(trimmed),
    trackingCarrier: parseTrackingCarrier(trimmed),
    labelPdfUrl,
    hasPaperlessQr: /qr code/i.test(trimmed),
  }
}
