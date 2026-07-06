/**
 * Email-client friendly HTML for inactive-winback listing grids.
 * Use in Klaviyo inside a **custom HTML** block:
 *   {{ event.featured_listings_html }}
 *
 * If Klaviyo escapes HTML in your template, use a Liquid `{% for %}` loop over
 * `event.featured_listings` instead (see file comment in `track-user-inactive-milestone.ts`).
 */

import type { KlaviyoInactiveFeaturedListing } from "@/lib/klaviyo/inactivity-featured-listings"
import {
  KLAVIYO_EMAIL_BORDER,
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

/**
 * Table-based, inline-styled block for ~Outlook + Gmail. Images are fixed width; links open listing PDPs.
 */
export function buildInactiveFeaturedListingsEmailHtml(
  listings: KlaviyoInactiveFeaturedListing[],
  marketplaceUrl: string,
): string {
  if (listings.length === 0) {
    const m = allowedUrl(marketplaceUrl) ?? "#"
    return `<p style="margin:0;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:15px;color:${C.muted};">No new listings to show right now — <a href="${escapeHtmlAttr(m)}" style="color:${C.link};text-decoration:underline;text-underline-offset:2px;">browse the marketplace</a>.</p>`
  }

  const rows: string[] = []

  for (const listing of listings) {
    const title = escapeHtmlText(listing.title)
    const listingHref = resolveListingUrlForEmail({
      url: listing.url,
      listing_id: listing.listing_id,
    })
    const href = allowedUrl(listingHref)
    const img = allowedUrl(listing.image_url)
    const price = escapeHtmlText(listing.price_display || "")
    const loc = escapeHtmlText(listing.location || "")

    const linkOpen = href ? `<a href="${escapeHtmlAttr(href)}" style="text-decoration:none;color:#111827;">` : ""
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
${loc ? `<p style="margin:4px 0 0 0;font-size:13px;color:${C.muted};">${loc}</p>` : ""}
${href ? `<p style="margin:10px 0 0 0;"><a href="${escapeHtmlAttr(href)}" style="display:inline-block;font-family:${KLAVIYO_EMAIL_FONT_SANS};font-size:14px;color:${C.link};font-weight:400;text-decoration:underline;text-underline-offset:2px;">View listing →</a></p>` : ""}
</td>
</tr>
</table>
</td>
</tr>`)
  }

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;">
${rows.join("\n")}
</table>`.trim()
}

/**
 * Plain-text fallback (single property) for text-only clients / Klaviyo plain-text version.
 */
export function buildInactiveFeaturedListingsPlainText(
  listings: KlaviyoInactiveFeaturedListing[],
  marketplaceUrl: string,
): string {
  if (listings.length === 0) {
    return `Browse new listings: ${marketplaceUrl}`
  }
  const lines = listings.map((l) => {
    const u = resolveListingUrlForEmail({ url: l.url, listing_id: l.listing_id })
    return `- ${l.title}${l.price_display ? ` — ${l.price_display}` : ""}${l.location ? ` (${l.location})` : ""}\n  ${u}`
  })
  return [`Fresh listings on Reswell:`, "", ...lines, "", `See more: ${marketplaceUrl}`].join("\n")
}
