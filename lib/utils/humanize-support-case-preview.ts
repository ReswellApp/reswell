import { isSupportStatusUpdateMessage } from "@/lib/messages/parse-support-thread-message"

/**
 * Turn stored ticket bodies (often journey metadata + customer text) into a
 * short, customer-friendly preview for Help lists and summaries.
 */
export function humanizeSupportCasePreview(raw: string, maxLen = 160): string {
  let text = raw.replace(/\r\n/g, "\n").trim()
  if (!text) return ""
  if (isSupportStatusUpdateMessage(text)) return ""

  const theirMessage = text.match(/Their message:\s*([\s\S]+)$/i)
  if (theirMessage?.[1]?.trim()) {
    text = theirMessage[1].trim()
  } else {
    // Drop self-serve / journey scaffolding; keep the customer's words.
    text = text
      .replace(/^What we showed them first:[\s\S]*?(?=\n\n|$)/i, "")
      .replace(/^Topic:\s*.+$/gim, "")
      .replace(/^Path:\s*.+$/gim, "")
      .replace(/^Reswell support ticket\s*/i, "")
      .replace(/^Ticket ID:\s*.+$/gim, "")
      .replace(/^You’ll get updates[\s\S]*$/gim, "")
      .replace(/^You'll get updates[\s\S]*$/gim, "")
      .replace(/^—+\s*$/gm, "")
      .trim()
  }

  text = text.replace(/\n{2,}/g, " ").replace(/\s+/g, " ").trim()

  if (!text) {
    // Fallback: last non-meta line from the original
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^topic:/i.test(l) &&
          !/^path:/i.test(l) &&
          !/^what we showed/i.test(l) &&
          !/^ticket id:/i.test(l) &&
          l !== "—" &&
          !/^reswell support ticket$/i.test(l),
      )
    text = (lines[lines.length - 1] ?? "").replace(/\s+/g, " ").trim()
  }

  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}
