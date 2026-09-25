import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_RADIUS,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_MUTED,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"
import type { EmailBlock, EmailStudioDocument } from "@/lib/types/emailStudio"

const FONT = KLAVIYO_EMAIL_FONT_SANS
const INK = KLAVIYO_EMAIL_COLORS.foreground
const LINK = KLAVIYO_EMAIL_COLORS.link
const BUTTON = KLAVIYO_EMAIL_COLORS.buttonBg
const BUTTON_TEXT = KLAVIYO_EMAIL_COLORS.buttonText

export interface EmailStudioRenderInput {
  name: string
  subject: string
  previewText: string
  flowName: string
  triggerMetric: string
  document: EmailStudioDocument
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function textToHtml(value: string): string {
  return escapeText(value).replace(/\r\n/g, "\n").replace(/\n/g, "<br>")
}

export function safeEmailHref(href: string): string {
  const trimmed = href.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("{{") || trimmed.startsWith("{%")) return escapeText(trimmed)
  if (/^https:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return escapeText(trimmed)
  return ""
}

function align(value: "left" | "center"): string {
  return value === "center" ? "center" : "left"
}

function buttonHtml(label: string, href: string): string {
  const safe = safeEmailHref(href)
  const inner = escapeText(label || "Open")
  const link = safe
    ? `<a href="${safe}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${BUTTON_TEXT};text-decoration:none;letter-spacing:-0.02em;">${inner}</a>`
    : `<span style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${BUTTON_TEXT};letter-spacing:-0.02em;">${inner}</span>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td align="center" bgcolor="${BUTTON}" style="border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};">${link}</td></tr></table>`
}

function imageHtml(src: string, alt: string, href: string): string {
  const safeSrc = safeEmailHref(src)
  if (!safeSrc) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#F4F6F8;border:1px dashed ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};"><tr><td align="center" style="padding:36px 16px;font-family:${FONT};font-size:13px;color:${KLAVIYO_EMAIL_MUTED};">Image</td></tr></table>`
  }
  const img = `<img src="${safeSrc}" alt="${escapeText(alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:${KLAVIYO_EMAIL_RADIUS};" />`
  const safeHref = safeEmailHref(href)
  return safeHref ? `<a href="${safeHref}" style="text-decoration:none;">${img}</a>` : img
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "logo": {
      const width = Math.min(220, Math.max(80, block.width || 140))
      const img = `<img src="${safeEmailHref(block.src) || safeEmailHref("https://www.reswell.app/images/reswell-logo.png")}" alt="${escapeText(block.alt || "Reswell")}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;" />`
      const href = safeEmailHref(block.href)
      const inner = href ? `<a href="${href}" style="text-decoration:none;">${img}</a>` : img
      return `<tr><td align="center" style="padding:0 0 28px 0;">${inner}</td></tr>`
    }
    case "eyebrow":
      return `<tr><td align="${align(block.align)}" style="padding:0 0 8px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${KLAVIYO_EMAIL_MUTED};">${textToHtml(block.text)}</td></tr>`
    case "heading":
      return `<tr><td align="${align(block.align)}" style="padding:0 0 16px 0;font-family:${FONT};font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.03em;color:${INK};">${textToHtml(block.text)}</td></tr>`
    case "text":
      return `<tr><td align="${align(block.align)}" style="padding:0 0 20px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};">${textToHtml(block.text)}</td></tr>`
    case "image":
      return `<tr><td align="center" style="padding:0 0 20px 0;">${imageHtml(block.src, block.alt, block.href)}</td></tr>`
    case "button":
      return `<tr><td align="${align(block.align)}" style="padding:4px 0 24px 0;">${buttonHtml(block.label, block.href)}</td></tr>`
    case "divider":
      return `<tr><td style="padding:4px 0 20px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${KLAVIYO_EMAIL_BORDER};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
    case "spacer": {
      const height = Math.min(80, Math.max(8, block.height || 24))
      return `<tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr>`
    }
    case "details": {
      const rows = block.rows
        .filter((row) => row.label.trim() || row.value.trim())
        .map(
          (row, index, all) =>
            `<tr><td style="padding:12px 0;${index < all.length - 1 ? `border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};` : ""}font-family:${FONT};font-size:15px;color:${KLAVIYO_EMAIL_MUTED};width:40%;">${textToHtml(row.label)}</td><td align="right" style="padding:12px 0;${index < all.length - 1 ? `border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};` : ""}font-family:${FONT};font-size:15px;font-weight:700;color:${INK};">${textToHtml(row.value)}</td></tr>`,
        )
        .join("")
      return `<tr><td style="padding:0 0 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};"><tr><td style="padding:20px 24px 8px 24px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${KLAVIYO_EMAIL_COLORS.price};">${textToHtml(block.title || "Details")}</td></tr><tr><td style="padding:0 24px 12px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table></td></tr></table></td></tr>`
    }
    case "split": {
      const copy = `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:18px;font-weight:700;line-height:1.3;color:${INK};">${textToHtml(block.title)}</p><p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};">${textToHtml(block.text)}</p>${block.buttonLabel.trim() ? buttonHtml(block.buttonLabel, block.buttonHref) : ""}`
      return `<tr><td style="padding:0 0 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td class="stack" valign="top" width="48%" style="padding:0 12px 12px 0;">${imageHtml(block.imageSrc, block.imageAlt, block.imageHref)}</td><td class="stack" valign="top" width="52%" style="padding:0 0 12px 12px;">${copy}</td></tr></table></td></tr>`
    }
    case "footer": {
      const unsub = block.showUnsubscribe
        ? `<br><br>{% unsubscribe 'Unsubscribe' %}`
        : ""
      return `<tr><td align="center" style="padding:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${KLAVIYO_EMAIL_MUTED};">${textToHtml(block.text)}${unsub}<br>{{ organization.name|default:'Reswell' }} · {{ organization.full_address|default:'' }}</td></tr>`
    }
  }
}

export function renderEmailStudioHtml(input: EmailStudioRenderInput): string {
  const preview = textToHtml(input.previewText)
  const blocks = input.document.blocks.map(renderBlock).join("\n")
  const comment = [
    "Reswell Email Studio",
    input.name ? `Project: ${input.name}` : "",
    input.subject ? `Subject: ${input.subject}` : "",
    input.previewText ? `Preview: ${input.previewText}` : "",
    input.triggerMetric ? `Trigger metric: ${input.triggerMetric}` : "",
    input.flowName ? `Flow: ${input.flowName}` : "",
    "Paste into Klaviyo → Email template → Code, or push this project from Email Studio.",
  ]
    .filter(Boolean)
    .map((line) => `  ${line.replace(/--/g, "—")}`)
    .join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeText(input.subject || input.name || "Reswell")}</title>
</head>
<body style="margin:0;padding:0;background:${KLAVIYO_EMAIL_COLORS.background};">
<!--
${comment}
-->
${preview ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preview}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${KLAVIYO_EMAIL_COLORS.background};">
  <tr>
    <td align="center" style="padding:28px 16px 40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;">
${blocks}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** Sample values for the display pane. Downloaded and pushed HTML stays untouched. */
export function withEmailPreviewSamples(html: string): string {
  const samples: [string, string][] = [
    ["{{ first_name|default:'there' }}", "Alex"],
    ["{{ event|lookup:'order_num' }}", "RW-1042"],
    ["{{ event|lookup:'Title' }}", "6'2 Pyzel Ghost"],
    ["{{ event|lookup:'$value' }}", "$640"],
    ["{{ event|lookup:'order_url'|default:'https://www.reswell.app' }}", "https://www.reswell.app"],
    ["{{ event|lookup:'listing_url'|default:'https://www.reswell.app' }}", "https://www.reswell.app"],
    ["{% unsubscribe 'Unsubscribe' %}", "Unsubscribe"],
    ["{{ organization.name|default:'Reswell' }}", "Reswell"],
    ["{{ organization.full_address|default:'' }}", "Los Angeles, CA"],
  ]
  return samples.reduce((next, [token, sample]) => next.replaceAll(token, sample), html)
}

export function renderEmailStudioText(input: EmailStudioRenderInput): string {
  const lines: string[] = []
  if (input.previewText.trim()) lines.push(input.previewText.trim(), "")
  for (const block of input.document.blocks) {
    if (block.type === "eyebrow" || block.type === "heading" || block.type === "text" || block.type === "footer") {
      if (block.text.trim()) lines.push(block.text.trim(), "")
    } else if (block.type === "button" && block.label.trim()) {
      lines.push(`${block.label.trim()}: ${block.href.trim()}`, "")
    } else if (block.type === "details") {
      if (block.title.trim()) lines.push(block.title.trim())
      for (const row of block.rows) lines.push(`${row.label}: ${row.value}`)
      lines.push("")
    } else if (block.type === "split") {
      lines.push(block.title.trim(), block.text.trim(), "")
    }
  }
  if (input.document.blocks.some((block) => block.type === "footer" && block.showUnsubscribe)) {
    lines.push("Unsubscribe: {% unsubscribe_link %}")
  }
  return lines.join("\n").trim()
}
