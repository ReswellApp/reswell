/**
 * Email-client friendly HTML for buyer favorites Klaviyo flows.
 *
 * **Klaviyo:** Add a **custom HTML** block and paste:
 *   {{ event.favorites_items_html }}
 *
 * If Klaviyo escapes HTML, use the Liquid loop in the file footer comment instead
 * over `event.checkout_items` (title, url, image_url, price_display).
 *
 * Plain-text version: {{ event.favorites_items_plain }}
 */

import type { KlaviyoCheckoutEventItem } from "@/lib/klaviyo/catalog-product"
import { resolveListingUrlForEmail } from "@/lib/klaviyo/email-listing-links"

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function allowedUrl(url: string): string | null {
  const t = url.trim()
  if (!/^https:\/\//i.test(t)) return null
  return t
}

export type BuildFavoritesEmailHtmlOptions = {
  favoritesUrl: string
  /** Shown above the grid on Favorite Price Drop flows, e.g. "$800 → $650" */
  priceDropDisplay?: string
  /** CTA label under the grid */
  viewAllLabel?: string
}

/**
 * Table-based, inline-styled product rows for Gmail + Outlook.
 */
export function buildFavoritesItemsEmailHtml(
  items: KlaviyoCheckoutEventItem[],
  options: BuildFavoritesEmailHtmlOptions,
): string {
  const favoritesHref = allowedUrl(options.favoritesUrl)
  const viewAllLabel = options.viewAllLabel?.trim() || "View all your saves"
  const priceDrop = options.priceDropDisplay?.trim()

  const parts: string[] = []

  if (priceDrop) {
    parts.push(`<p style="margin:0 0 16px 0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;font-weight:600;color:#059669;">Now ${escapeHtmlText(priceDrop)}</p>`)
  }

  if (items.length === 0) {
    const m = favoritesHref ?? "#"
    parts.push(
      `<p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#444;">You don&apos;t have any saved boards right now — <a href="${escapeHtmlAttr(m)}" style="color:#2563eb;">browse the marketplace</a>.</p>`,
    )
    return parts.join("\n")
  }

  const rows: string[] = []

  for (const item of items) {
    const title = escapeHtmlText(item.title || "Saved listing")
    const href = allowedUrl(
      resolveListingUrlForEmail({ url: item.url, listing_id: item.listing_id }),
    )
    const img = allowedUrl(item.image_url)
    const price = escapeHtmlText(item.price_display || "")

    const linkOpen = href
      ? `<a href="${escapeHtmlAttr(href)}" style="text-decoration:none;color:#111827;">`
      : ""
    const linkClose = href ? `</a>` : ""

    const imgBlock = img
      ? `${linkOpen}<img src="${escapeHtmlAttr(img)}" alt="${title}" width="240" height="180" style="display:block;width:240px;max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e7eb;object-fit:cover;" />${linkClose}`
      : ""

    rows.push(`<tr>
<td style="padding:0 0 20px 0;vertical-align:top;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
<tr>
<td width="240" style="padding:0 16px 0 0;vertical-align:top;">${imgBlock}</td>
<td style="vertical-align:top;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
${href ? `<a href="${escapeHtmlAttr(href)}" style="font-size:16px;font-weight:600;color:#111827;text-decoration:none;">${title}</a>` : `<span style="font-size:16px;font-weight:600;color:#111827;">${title}</span>`}
${price ? `<p style="margin:6px 0 0 0;font-size:15px;color:#374151;font-weight:600;">${price}</p>` : ""}
${href ? `<p style="margin:10px 0 0 0;"><a href="${escapeHtmlAttr(href)}" style="display:inline-block;font-size:14px;color:#2563eb;font-weight:600;">View listing →</a></p>` : ""}
</td>
</tr>
</table>
</td>
</tr>`)
  }

  parts.push(`
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;">
${rows.join("\n")}
</table>`.trim())

  if (favoritesHref && items.length > 1) {
    parts.push(
      `<p style="margin:20px 0 0 0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;"><a href="${escapeHtmlAttr(favoritesHref)}" style="display:inline-block;font-size:15px;color:#2563eb;font-weight:600;text-decoration:none;">${escapeHtmlText(viewAllLabel)} →</a></p>`,
    )
  }

  return parts.join("\n")
}

export function buildFavoritesItemsPlainText(
  items: KlaviyoCheckoutEventItem[],
  favoritesUrl: string,
  priceDropDisplay?: string,
): string {
  const lines: string[] = []
  if (priceDropDisplay?.trim()) {
    lines.push(`Price drop: ${priceDropDisplay.trim()}`, "")
  }
  if (items.length === 0) {
    lines.push(`Browse saved boards: ${favoritesUrl}`)
    return lines.join("\n")
  }
  for (const item of items) {
    const u = resolveListingUrlForEmail({ url: item.url, listing_id: item.listing_id })
    lines.push(
      `- ${item.title}${item.price_display ? ` — ${item.price_display}` : ""}`,
      `  ${u}`,
      "",
    )
  }
  lines.push(`View all saves: ${favoritesUrl}`)
  return lines.join("\n")
}

export function favoritesKlaviyoEmailProperties(
  checkoutItems: KlaviyoCheckoutEventItem[],
  favoritesUrl: string,
  options?: { priceDropDisplay?: string; viewAllLabel?: string },
): {
  favorites_items_html: string
  favorites_items_plain: string
} {
  return {
    favorites_items_html: buildFavoritesItemsEmailHtml(checkoutItems, {
      favoritesUrl,
      priceDropDisplay: options?.priceDropDisplay,
      viewAllLabel: options?.viewAllLabel,
    }),
    favorites_items_plain: buildFavoritesItemsPlainText(
      checkoutItems,
      favoritesUrl,
      options?.priceDropDisplay,
    ),
  }
}
