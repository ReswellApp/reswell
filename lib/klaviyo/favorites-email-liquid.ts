/**
 * Copy-paste templates for Klaviyo **HTML** blocks (Favorite Price Drop flow).
 *
 * **Klaviyo audit checklist (blocks outside this HTML):**
 * - Logo block → add alt text "Reswell"
 * - "Price Drop!" h1 → font-weight 700 (remove inline 400 override)
 * - Remove any extra solid buttons (e.g. "View My Order" from other templates)
 * - Footer body text → 16px minimum
 *
 * **This HTML block:** one primary button, title links to listing (no redundant links).
 */

import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_BODY_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_RADIUS,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_HORIZONTAL_PADDING,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"

const C = KLAVIYO_EMAIL_COLORS
const fontSans = KLAVIYO_EMAIL_FONT_SANS
const fontHeadline = KLAVIYO_EMAIL_FONT_HEADLINE

/**
 * **Paste this in Klaviyo** — HTML block, Favorite Price Drop flow email.
 * No `{% if %}`, `{% for %}`, or `{% elsif %}` (Klaviyo often renders those as visible text).
 * Insert each `{{ event… }}` via Preview → Event properties if typing them fails.
 */
export const KLAVIYO_FAVORITE_PRICE_DROP_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">

<p style="margin:0 0 16px 0;font-family:${fontHeadline};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};font-weight:600;color:${C.priceDrop};letter-spacing:-0.02em;">Now {{ event|lookup:'price_drop_display' }}</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;margin:0 0 20px 0;">
  <tr>
    <td width="240" style="padding:0 16px 0 0;vertical-align:top;">
      <a href="{{ event|lookup:'listing_url' }}" style="text-decoration:none;">
        <img src="{{ event.Items.0.ImageURL }}" alt="{{ event|lookup:'Title' }}" width="240" height="180" style="display:block;width:240px;max-width:100%;height:auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;" />
      </a>
    </td>
    <td style="vertical-align:top;font-family:${fontSans};color:${C.muted};">
      <a href="{{ event|lookup:'listing_url' }}" style="font-family:${fontHeadline};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;">{{ event|lookup:'Title' }}</a>
      <p style="margin:6px 0 0 0;font-family:${fontHeadline};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};color:${C.price};font-weight:600;">{{ event.checkout_items.0.price_display }}</p>
    </td>
  </tr>
</table>

<p style="margin:20px 0 0 0;font-family:${fontSans};">
  <a href="{{ event|lookup:'checkout_url' }}" style="display:inline-block;padding:12px 20px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};letter-spacing:-0.02em;">Complete checkout</a>
</p>

</td>
</tr>
</table>`.trim()

const priceDropBannerStyle = `margin:0 0 16px 0;font-family:${fontHeadline};font-size:16px;font-weight:600;color:${C.priceDrop};letter-spacing:-0.02em;`
const cellStyle = `vertical-align:top;font-family:${fontSans};color:${C.muted};`
const titleLinkStyle = `font-family:${fontHeadline};font-size:16px;font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;`
const priceStyle = `margin:6px 0 0 0;font-family:${fontHeadline};font-size:15px;color:${C.price};font-weight:600;`
const viewLinkStyle = `display:inline-block;font-family:${fontSans};font-size:14px;color:${C.link};font-weight:400;text-decoration:underline;text-underline-offset:2px;`
const imgStyle = `display:block;width:240px;max-width:100%;height:auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;`
const textLinkStyle = `display:inline-block;font-family:${fontSans};font-size:15px;color:${C.link};font-weight:400;text-decoration:underline;text-underline-offset:2px;`
const buttonStyle = `display:inline-block;padding:12px 20px;font-family:${fontSans};font-size:15px;font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};letter-spacing:-0.02em;`

/** @deprecated Prefer KLAVIYO_FAVORITE_PRICE_DROP_EMAIL_HTML — Liquid tags often show as raw text in Klaviyo. */
export const KLAVIYO_FAVORITE_PRICE_DROP_EMAIL_LIQUID = `{% if event.price_drop_display %}
<p style="${priceDropBannerStyle}">
  Now {{ event.price_drop_display }}
</p>
{% endif %}

{% for item in event.checkout_items %}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;margin:0 0 20px 0;">
  <tr>
    <td width="240" style="padding:0 16px 0 0;vertical-align:top;">
      {% if item.image_url %}
      <a href="{{ item.url }}" style="text-decoration:none;">
        <img src="{{ item.image_url }}" alt="{{ item.title }}" width="240" height="180" style="${imgStyle}" />
      </a>
      {% endif %}
    </td>
    <td style="${cellStyle}">
      <a href="{{ item.url }}" style="${titleLinkStyle}">{{ item.title }}</a>
      {% if item.price_display %}
      <p style="${priceStyle}">{{ item.price_display }}</p>
      {% endif %}
      <p style="margin:10px 0 0 0;">
        <a href="{{ item.url }}" style="${viewLinkStyle}">View listing →</a>
      </p>
    </td>
  </tr>
</table>
{% endfor %}

{% if event.in_cart and event.checkout_url %}
<p style="margin:20px 0 0 0;font-family:${fontSans};">
  <a href="{{ event.checkout_url }}" style="${buttonStyle}">Complete checkout →</a>
</p>
{% elsif event.favorites_url %}
<p style="margin:20px 0 0 0;font-family:${fontSans};">
  <a href="{{ event.favorites_url }}" style="${textLinkStyle}">View all your saves →</a>
</p>
{% endif %}`.trim()

/**
 * Multi-listing favorites email (Listing Saved, Favorites Digest).
 * Loops `event.checkout_items`; optional footer link to `event.favorites_url`.
 */
export const KLAVIYO_FAVORITES_LISTING_EMAIL_LIQUID = `{% for item in event.checkout_items %}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;margin:0 0 20px 0;">
  <tr>
    <td width="240" style="padding:0 16px 0 0;vertical-align:top;">
      {% if item.image_url %}
      <a href="{{ item.url }}" style="text-decoration:none;">
        <img src="{{ item.image_url }}" alt="{{ item.title }}" width="240" height="180" style="${imgStyle}" />
      </a>
      {% endif %}
    </td>
    <td style="${cellStyle}">
      <a href="{{ item.url }}" style="${titleLinkStyle}">{{ item.title }}</a>
      {% if item.price_display %}
      <p style="${priceStyle}">{{ item.price_display }}</p>
      {% endif %}
      <p style="margin:10px 0 0 0;">
        <a href="{{ item.url }}" style="${viewLinkStyle}">View listing →</a>
      </p>
    </td>
  </tr>
</table>
{% endfor %}

{% if event.favorites_url %}
<p style="margin:20px 0 0 0;font-family:${fontSans};">
  <a href="{{ event.favorites_url }}" style="${textLinkStyle}">View all your saves →</a>
</p>
{% endif %}`.trim()

/**
 * Single-listing shortcut when you do not want a `{% for %}` loop.
 * Requires flat scalars on the event (`listing_image_url`, `listing_url`, etc.).
 */
export const KLAVIYO_SINGLE_LISTING_EMAIL_LIQUID = `{% if event.price_drop_display %}
<p style="${priceDropBannerStyle}">
  Now {{ event.price_drop_display }}
</p>
{% endif %}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;">
  <tr>
    <td width="240" style="padding:0 16px 0 0;vertical-align:top;">
      {% if event.listing_image_url %}
      <a href="{{ event.listing_url }}" style="text-decoration:none;">
        <img src="{{ event.listing_image_url }}" alt="{{ event.Title }}" width="240" height="180" style="${imgStyle}" />
      </a>
      {% endif %}
    </td>
    <td style="${cellStyle}">
      <a href="{{ event.listing_url }}" style="${titleLinkStyle}">{{ event.Title }}</a>
      {% if event.listing_price_display %}
      <p style="${priceStyle}">{{ event.listing_price_display }}</p>
      {% endif %}
      <p style="margin:10px 0 0 0;">
        <a href="{{ event.listing_url }}" style="${viewLinkStyle}">View listing →</a>
      </p>
    </td>
  </tr>
</table>

{% if event.in_cart and event.checkout_url %}
<p style="margin:20px 0 0 0;font-family:${fontSans};">
  <a href="{{ event.checkout_url }}" style="${buttonStyle}">Complete checkout →</a>
</p>
{% endif %}`.trim()
