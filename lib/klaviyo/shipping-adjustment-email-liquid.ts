/**
 * Copy-paste HTML for the seller **Shipping Adjustment** email.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Shipping Adjustment**
 * 2. Trigger filter: `reswell_metric_seed` is not true
 * 3. Email → Code / custom HTML → paste `KLAVIYO_SHIPPING_ADJUSTMENT_EMAIL_HTML`
 * 4. Suggested subject: `Carrier adjustment on {{ event.Title }}`
 *
 * The event already chooses the sentence for a covered strike vs a deduction.
 * Use `{{ event|lookup:'headline' }}` and `{{ event|lookup:'message' }}`.
 */

import {
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_HORIZONTAL_PADDING,
} from "@/lib/klaviyo/email-brand-styles"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

const C = KLAVIYO_EMAIL_COLORS
const fontSans = KLAVIYO_EMAIL_FONT_SANS
const fontHeadline = KLAVIYO_EMAIL_FONT_HEADLINE
const siteOrigin = publicSiteOriginForEmail()
const logoUrl = `${siteOrigin}/images/reswell-logo.png`

const pillButtonStyle = `display:inline-block;padding:14px 32px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:50px;letter-spacing:-0.02em;`

export const KLAVIYO_SHIPPING_ADJUSTMENT_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    {{ event|lookup:'headline' }}
  </h1>
</td>
</tr>
<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:14px;color:${C.muted};text-align:center;">
    Order #{{ event|lookup:'order_num' }} · {{ event|lookup:'amount_display' }}
  </p>
</td>
</tr>
<tr>
<td style="padding:20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:16px;line-height:1.55;color:${C.foreground};text-align:center;">
    {{ event|lookup:'message' }}
  </p>
</td>
</tr>
<tr>
<td align="center" style="padding:28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'how_to_ship_url' }}" style="${pillButtonStyle}">How to pack the next box</a>
</td>
</tr>
<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'sale_url' }}" style="font-family:${fontSans};font-size:14px;color:${C.link};text-decoration:underline;">View this sale</a>
</td>
</tr>
</table>
</td>
</tr>
</table>`
