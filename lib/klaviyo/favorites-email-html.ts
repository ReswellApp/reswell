/**
 * Email-client friendly HTML for buyer favorites Klaviyo flows.
 *
 * **Important:** Klaviyo escapes HTML stored in event properties. Do **not** use
 * `{{ event.favorites_items_html }}` in a custom HTML block — it prints raw tags.
 *
 * **Instead:** In Klaviyo → Email → drag **Code** / custom HTML → paste Liquid from
 * `lib/klaviyo/favorites-email-liquid.ts` (`KLAVIYO_FAVORITE_PRICE_DROP_EMAIL_LIQUID`
 * or `KLAVIYO_FAVORITES_LISTING_EMAIL_LIQUID`). Those templates loop
 * `event.checkout_items` (title, url, image_url, price_display) and render real HTML.
 *
 * Plain-text version still works: `{{ event.favorites_items_plain }}`
 */

import type { KlaviyoCheckoutEventItem } from "@/lib/klaviyo/catalog-product"
import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_BUTTON_RADIUS,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"
import { resolveListingUrlForEmail } from "@/lib/klaviyo/email-listing-links"

const C = KLAVIYO_EMAIL_COLORS

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
  /** Primary button below the listing row (e.g. checkout when item is in cart) */
  primaryActionUrl?: string
  primaryActionLabel?: string
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
  const primaryHref = allowedUrl(options.primaryActionUrl ?? "")
  const primaryLabel = options.primaryActionLabel?.trim()

  const parts: string[] = []

  if (priceDrop) {
    parts.push(
      `<p style="margin:0 0 16px 0;font-family:${KLAVIYO_EMAIL_FONT_HEADLINE};font-size:16px;font-weight:600;color:${C.priceDrop};letter-spacing:-0.02em;">Now ${escapeHtmlText(priceDrop)}</p>`,
    )
  }

  if (items.length === 0) {
    const m = favoritesHref ?? "#"
    parts.push(
      `<p style="margin:0;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:15px;color:${C.muted};">You don&apos;t have any saved listings right now — <a href="${escapeHtmlAttr(m)}" style="color:${C.link};text-decoration:underline;text-underline-offset:2px;">browse the marketplace</a>.</p>`,
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
      ? `${linkOpen}<img src="${escapeHtmlAttr(img)}" alt="${title}" width="240" height="180" style="display:block;width:240px;max-width:100%;height:auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;" />${linkClose}`
      : ""

    rows.push(`<tr>
<td style="padding:0 0 20px 0;vertical-align:top;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
<tr>
<td width="240" style="padding:0 16px 0 0;vertical-align:top;">${imgBlock}</td>
<td style="vertical-align:top;font-family:${KLAVIYO_EMAIL_FONT_SANS};color:${C.muted};">
${href ? `<a href="${escapeHtmlAttr(href)}" style="font-family:${KLAVIYO_EMAIL_FONT_HEADLINE};font-size:16px;font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;">${title}</a>` : `<span style="font-family:${KLAVIYO_EMAIL_FONT_HEADLINE};font-size:16px;font-weight:600;color:${C.foreground};letter-spacing:-0.02em;">${title}</span>`}
${price ? `<p style="margin:6px 0 0 0;font-family:${KLAVIYO_EMAIL_FONT_HEADLINE};font-size:15px;color:${C.price};font-weight:600;">${price}</p>` : ""}
${href ? `<p style="margin:10px 0 0 0;"><a href="${escapeHtmlAttr(href)}" style="display:inline-block;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:14px;color:${C.link};font-weight:400;text-decoration:underline;text-underline-offset:2px;">View listing →</a></p>` : ""}
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

  if (primaryHref && primaryLabel) {
    parts.push(
      `<p style="margin:20px 0 0 0;font-family:${KLAVIYO_EMAIL_FONT_SANS};"><a href="${escapeHtmlAttr(primaryHref)}" style="display:inline-block;padding:12px 20px;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:15px;color:${C.buttonText};font-weight:600;text-decoration:none;background:${C.buttonBg};border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};letter-spacing:-0.02em;">${escapeHtmlText(primaryLabel)} →</a></p>`,
    )
  }

  if (favoritesHref && items.length > 1) {
    parts.push(
      `<p style="margin:20px 0 0 0;font-family:${KLAVIYO_EMAIL_FONT_SANS};"><a href="${escapeHtmlAttr(favoritesHref)}" style="display:inline-block;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:15px;color:${C.link};font-weight:400;text-decoration:underline;text-underline-offset:2px;">${escapeHtmlText(viewAllLabel)} →</a></p>`,
    )
  }

  return parts.join("\n")
}

export function buildFavoritesItemsPlainText(
  items: KlaviyoCheckoutEventItem[],
  favoritesUrl: string,
  priceDropDisplay?: string,
  primaryAction?: { url: string; label: string },
): string {
  const lines: string[] = []
  if (priceDropDisplay?.trim()) {
    lines.push(`Price drop: ${priceDropDisplay.trim()}`, "")
  }
  if (items.length === 0) {
    lines.push(`Browse saved listings: ${favoritesUrl}`)
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
  if (primaryAction?.url?.trim() && primaryAction.label?.trim()) {
    lines.push(`${primaryAction.label.trim()}: ${primaryAction.url.trim()}`, "")
  }
  lines.push(`View all saves: ${favoritesUrl}`)
  return lines.join("\n")
}

export function favoritesKlaviyoEmailProperties(
  checkoutItems: KlaviyoCheckoutEventItem[],
  favoritesUrl: string,
  options?: {
    priceDropDisplay?: string
    viewAllLabel?: string
    primaryActionUrl?: string
    primaryActionLabel?: string
  },
): {
  favorites_items_html: string
  favorites_items_plain: string
} {
  return {
    favorites_items_html: buildFavoritesItemsEmailHtml(checkoutItems, {
      favoritesUrl,
      priceDropDisplay: options?.priceDropDisplay,
      viewAllLabel: options?.viewAllLabel,
      primaryActionUrl: options?.primaryActionUrl,
      primaryActionLabel: options?.primaryActionLabel,
    }),
    favorites_items_plain: buildFavoritesItemsPlainText(
      checkoutItems,
      favoritesUrl,
      options?.priceDropDisplay,
      options?.primaryActionUrl && options?.primaryActionLabel
        ? { url: options.primaryActionUrl, label: options.primaryActionLabel }
        : undefined,
    ),
  }
}
