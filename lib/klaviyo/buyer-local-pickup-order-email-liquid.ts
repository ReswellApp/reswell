/**
 * Copy-paste HTML for Klaviyo buyer **local pickup** order confirmation emails.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Local Pickup Order Placed**
 * 2. Email → drag **HTML** block (not Text) into your existing template body
 * 3. Paste `KLAVIYO_BUYER_LOCAL_PICKUP_ORDER_EMAIL_HTML` below
 * 4. Preview with a recent **Local Pickup Order Placed** event
 *
 * **Important (learned from Favorite Price Drop flow):**
 * - No `{% if %}`, `{% for %}`, or `{% currency_format %}` — Klaviyo often prints those as raw text
 * - No logo / outer page wrapper — your Klaviyo template shell already provides those
 * - Use properties that exist on **all** events: `Items.0.ImageURL`, `Items.0.RowTotal`, `$value`
 * - `listing_image_url`, `order_total_display` only exist on events after the 2026-07 enrich — re-emit old orders via Admin → reemit Purchase Successful (also refreshes Local Pickup Order Placed)
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

const imgStyle = `display:block;width:240px;max-width:100%;height:auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;`
const titleLinkStyle = `font-family:${fontHeadline};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;line-height:1.3;`
const priceStyle = `margin:6px 0 0 0;font-family:${fontHeadline};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};color:${C.price};font-weight:600;`
const buttonStyle = `display:inline-block;padding:12px 24px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};letter-spacing:-0.02em;`

/**
 * **Paste this in Klaviyo** — content-only HTML block inside your template shell.
 * Trigger: **Local Pickup Order Placed**.
 */
export const KLAVIYO_BUYER_LOCAL_PICKUP_ORDER_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">

<p style="margin:0 0 20px 0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};line-height:1.5;color:${C.foreground};">
  Your local pickup order for <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> is confirmed. Coordinate pickup with your seller and bring your code when you meet.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 0 24px 0;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};background:#F8FAFC;">
  <tr>
    <td align="center" style="padding:20px 20px 6px 20px;font-family:${fontSans};font-size:11px;font-weight:600;color:${C.muted};letter-spacing:0.12em;text-transform:uppercase;">
      Your pickup code
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 20px 10px 20px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;color:${C.foreground};letter-spacing:0.24em;line-height:1.1;">
      {{ event|lookup:'pickup_code' }}
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 20px 20px 20px;font-family:${fontSans};font-size:14px;line-height:1.5;color:${C.muted};">
      Order #{{ event|lookup:'order_num' }} &mdash; show this code at handoff so the seller can confirm pickup.
    </td>
  </tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;margin:0 0 24px 0;">
  <tr>
    <td width="240" style="padding:0 16px 0 0;vertical-align:top;">
      <a href="{{ event|lookup:'listing_url' }}" style="text-decoration:none;">
        <img src="{{ event.Items.0.ImageURL }}" alt="{{ event|lookup:'Title' }}" width="240" height="180" style="${imgStyle}" />
      </a>
    </td>
    <td style="vertical-align:top;font-family:${fontSans};color:${C.muted};">
      <a href="{{ event|lookup:'listing_url' }}" style="${titleLinkStyle}">{{ event|lookup:'Title' }}</a>
      <p style="${priceStyle}">\${{ event|lookup:'$value' }}</p>
      <p style="margin:10px 0 0 0;font-family:${fontSans};font-size:14px;color:${C.muted};">
        Local pickup &mdash; message the seller to arrange time and place.
      </p>
    </td>
  </tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 0 24px 0;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};">
  <tr>
    <td style="padding:14px 18px;font-family:${fontSans};font-size:15px;color:${C.foreground};border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};">
      <span style="font-weight:500;">{{ event|lookup:'Title' }}</span>
    </td>
    <td align="right" style="padding:14px 18px;font-family:${fontSans};font-size:15px;color:${C.foreground};font-weight:600;border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};white-space:nowrap;">
      \${{ event.Items.0.RowTotal }}
    </td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.foreground};">
      Total
    </td>
    <td align="right" style="padding:14px 18px;font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.price};white-space:nowrap;">
      \${{ event|lookup:'$value' }}
    </td>
  </tr>
</table>

<p style="margin:0 0 16px 0;font-family:${fontSans};">
  <a href="{{ event|lookup:'order_url' }}" style="${buttonStyle}">View order</a>
</p>

<p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};">
  Questions for the seller? Open your order or use Messages anytime.
</p>

</td>
</tr>
</table>`.trim()
