/**
 * Copy-paste HTML for Klaviyo seller **Earnings Available** emails.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Earnings Available**
 * 2. Trigger filter: `reswell_metric_seed` is not true
 * 3. Email → drag **Code** / custom HTML → paste `KLAVIYO_EARNINGS_AVAILABLE_EMAIL_HTML`
 * 4. Preview with a recent **Earnings Available** event
 * 5. Suggested subject: `Your earnings from {{ event.Title }} are available`
 * 6. Suggested preview: `${{ event.seller_earnings }} is ready in your wallet`
 *
 * **Do not** also trigger this email from **Sale Successful** (same unlock moment).
 *
 * **Event variables** (from `track-earnings-available.ts`):
 * - `order_num`, `Title`, `sale_url`, `listing_url`, `earnings_url`, `photo_url`
 * - `seller_earnings`, `order_amount`, `platform_fee` (numbers, prefixed with `$` in the template)
 * - `fulfillment_method`, `payment_method`
 *
 * **Klaviyo notes**
 * - No `{% if %}`, `{% for %}`, or `{% currency_format %}` — those often print as raw text
 * - If your template shell already has a logo, delete the logo row below
 * - Footer unsubscribe / address blocks stay in Klaviyo's template shell
 */

import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_BODY_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_HORIZONTAL_PADDING,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

const C = KLAVIYO_EMAIL_COLORS
const fontSans = KLAVIYO_EMAIL_FONT_SANS
const fontHeadline = KLAVIYO_EMAIL_FONT_HEADLINE
const siteOrigin = publicSiteOriginForEmail()
const logoUrl = `${siteOrigin}/images/reswell-logo.png`

const pillButtonStyle = `display:inline-block;padding:14px 48px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:50px;letter-spacing:-0.02em;mso-padding-alt:0;`

const summaryRowStyle = `padding:12px 0;border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};font-family:${fontSans};font-size:15px;color:${C.foreground};`

/**
 * **Paste this in Klaviyo** — seller earnings unlocked into the wallet.
 * Trigger: **Earnings Available**.
 */
export const KLAVIYO_EARNINGS_AVAILABLE_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
<tr>
<td align="center" style="padding:32px 16px 40px 16px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:600px;">
<tr>
<td align="center" style="padding:0 0 28px 0;">
  <a href="${siteOrigin}" style="text-decoration:none;">
    <img src="${logoUrl}" alt="Reswell" width="160" height="40" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
  </a>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <h1 style="margin:0;font-family:${fontHeadline};font-size:28px;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;line-height:1.2;text-align:center;">
    Your earnings are available
  </h1>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:14px;color:${C.muted};text-align:center;">
    Order #{{ event|lookup:'order_num' }}
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};line-height:1.5;color:${C.foreground};text-align:center;">
    <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> has cleared. You can spend this in your Reswell wallet or send it to your bank.
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 16px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'listing_url' }}" style="text-decoration:none;">
    <img src="{{ event|lookup:'photo_url' }}" alt="{{ event|lookup:'Title' }}" width="400" style="display:block;width:100%;max-width:400px;height:auto;margin:0 auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};" />
  </a>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Unlocked sale
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">Listing</td>
            <td align="right" style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'Title' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">Order total</td>
            <td align="right" style="${summaryRowStyle}white-space:nowrap;font-weight:600;">\${{ event|lookup:'order_amount' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 20px 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.foreground};">Ready in your wallet</td>
            <td align="right" style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.price};">\${{ event|lookup:'seller_earnings' }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'earnings_url' }}" style="${pillButtonStyle}">View earnings</a>
</td>
</tr>

<tr>
<td align="center" style="padding:8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'sale_url' }}" style="font-family:${fontSans};font-size:15px;font-weight:600;color:${C.link};text-decoration:none;">Open this sale</a>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()
