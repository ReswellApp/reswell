/**
 * Copy-paste HTML for Klaviyo seller **Local Pickup Sale Received** emails.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Local Pickup Sale Received**
 * 2. Email → drag **Code** / custom HTML → paste `KLAVIYO_SELLER_LOCAL_PICKUP_SALE_RECEIVED_EMAIL_HTML`
 * 3. Preview with a recent **Local Pickup Sale Received** event
 * 4. Suggested subject: `You sold {{ event.Title }} — arrange local pickup`
 *
 * **Do not** also trigger this email from **New Sale Received** (same order, double send).
 *
 * **Event variables** (from `track-seller-local-pickup-sale-received.ts`):
 * - `order_num`, `Title`, `buyer_display_name`, `sale_url`, `listing_url`
 * - `seller_earnings`, `order_amount` (numbers, prefixed with `$` in the template)
 * - `pickup_instructions` (plain-text next-step paragraph)
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

const stepNumStyle = `width:28px;height:28px;line-height:28px;text-align:center;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.buttonText};background:${C.buttonBg};border-radius:50%;`

/**
 * **Paste this in Klaviyo** — seller local pickup sale.
 * Trigger: **Local Pickup Sale Received**.
 */
export const KLAVIYO_SELLER_LOCAL_PICKUP_SALE_RECEIVED_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    You made a sale
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
    {{ event|lookup:'buyer_display_name' }} bought <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> for local pickup. Message them to set a time and a safe public meeting place.
  </p>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Sale summary
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">Item</td>
            <td align="right" style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'Title' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">Buyer</td>
            <td align="right" style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'buyer_display_name' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">Fulfillment</td>
            <td align="right" style="${summaryRowStyle}font-weight:600;">Local pickup</td>
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
            <td style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.foreground};">Your earnings</td>
            <td align="right" style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.price};">\${{ event|lookup:'seller_earnings' }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Pickup
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 16px 20px;font-family:${fontSans};font-size:15px;line-height:1.55;color:${C.foreground};">{{ event|lookup:'pickup_instructions' }}</td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;">
    <tr>
      <td style="padding:0 0 16px 0;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        What happens next
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td width="40" valign="top" style="padding:0 12px 0 0;"><div style="${stepNumStyle}">1</div></td>
            <td style="font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.foreground};">Message the buyer to agree on a time and a safe, public meeting place.</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td width="40" valign="top" style="padding:0 12px 0 0;"><div style="${stepNumStyle}">2</div></td>
            <td style="font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.foreground};">The buyer has a 6-digit pickup code on their purchase page. Ask for it when they&rsquo;re ready to take the item.</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td width="40" valign="top" style="padding:0 12px 0 0;"><div style="${stepNumStyle}">3</div></td>
            <td style="font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.foreground};">Open your sale page, tap Verify pickup, and enter the code to complete the handoff.</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td width="40" valign="top" style="padding:0 12px 0 0;"><div style="${stepNumStyle}">4</div></td>
            <td style="font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.foreground};">Your earnings release to your wallet after the pickup code is verified.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'sale_url' }}" style="${pillButtonStyle}">View sale</a>
</td>
</tr>

<tr>
<td align="center" style="padding:8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'listing_url' }}" style="font-family:${fontSans};font-size:15px;font-weight:600;color:${C.link};text-decoration:none;">View listing</a>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()
