/**
 * Copy-paste HTML for Klaviyo **Support Tickets Response** flow.
 *
 * Metric: `Support Tickets Response` (API)
 * Flow: Support Tickets Response (id RuDgCm)
 *
 * Event properties:
 * - `{{ event.response }}` — staff reply body
 * - `{{ event.ticket_url }}` — Dashboard → Support deep link
 * - `{{ event.support_ticket_id }}`
 * - `{{ event.response_type }}` — admin_inbox_reply | support_dm_reply | status_update
 */

import {
  KLAVIYO_EMAIL_BODY_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_RADIUS,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_HORIZONTAL_PADDING,
} from "@/lib/klaviyo/email-brand-styles"

const C = KLAVIYO_EMAIL_COLORS
const fontSans = KLAVIYO_EMAIL_FONT_SANS
const fontHeadline = KLAVIYO_EMAIL_FONT_HEADLINE

/**
 * Paste into the Support Tickets Response flow email (Code / HTML block).
 * Prefer inserting `{{ event… }}` via Preview → Event properties if typing fails.
 */
export const KLAVIYO_SUPPORT_TICKET_RESPONSE_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
<tr>
<td align="center" style="padding:32px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:560px;margin:0 auto;">

<tr>
<td style="padding:0 0 16px 0;font-family:${fontHeadline};font-size:20px;font-weight:700;color:${C.foreground};letter-spacing:-0.02em;">
Reswell Support
</td>
</tr>

<tr>
<td style="padding:0 0 20px 0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};line-height:1.5;color:${C.foreground};white-space:pre-wrap;">{{ event|lookup:'response' }}</td>
</tr>

<tr>
<td style="padding:0 0 24px 0;">
  <a href="{{ event|lookup:'ticket_url' }}" style="display:inline-block;padding:12px 20px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:${KLAVIYO_EMAIL_BUTTON_RADIUS};letter-spacing:-0.02em;">View support ticket</a>
</td>
</tr>

<tr>
<td style="padding:0;font-family:${fontSans};font-size:14px;line-height:1.5;color:${C.muted};">
If the button doesn’t work, open: {{ event|lookup:'ticket_url' }}
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()
