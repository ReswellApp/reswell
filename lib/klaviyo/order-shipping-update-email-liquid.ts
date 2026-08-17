/**
 * Copy-paste HTML for Klaviyo buyer **Order Shipping Update** emails.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Order Shipping Update**
 * 2. Optional split: `status_code` equals `DE`
 *    - Delivered → paste `KLAVIYO_ORDER_DELIVERED_EMAIL_HTML`
 *    - Everyone else → paste `KLAVIYO_ORDER_SHIPPING_UPDATE_EMAIL_HTML`
 * 3. Preview with a recent **Order Shipping Update** event to verify variables
 * 4. In-transit subject: `{{ event.status_label }} — {{ event.Title }}`
 *    Delivered subject: `Your order has been delivered — {{ event.Title }}`
 *
 * **Event variables** (from `track-order-shipping-update.ts`):
 * - `Title`, `order_num`, `order_url`
 * - `status_label`, `latest_event_description`, `latest_event_location`
 * - `tracking_number`, `tracking_carrier`, `estimated_delivery_date`
 * - `is_delivered`, `status_code`
 *
 * **Klaviyo notes**
 * - No `{% if %}`, `{% for %}`, or `{% elsif %}` — those often print as raw text
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

const lastRowStyle = `padding:12px 0 0 0;font-family:${fontSans};font-size:15px;color:${C.foreground};`

/**
 * **Paste this in Klaviyo** — buyer carrier scan update.
 * Trigger: **Order Shipping Update**.
 */
export const KLAVIYO_ORDER_SHIPPING_UPDATE_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    {{ event|lookup:'status_label' }}
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
    Latest on <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong>
  </p>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Shipment details
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Item</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'Title' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Location</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'latest_event_location' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Est. delivery</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event.estimated_delivery_date|format_date_string|date:'F j, Y' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Carrier</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'tracking_carrier' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${lastRowStyle}color:${C.muted};width:42%;vertical-align:top;">Tracking</td>
            <td style="${lastRowStyle}font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;word-break:break-all;">{{ event|lookup:'tracking_number' }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">View order</a>
</td>
</tr>

<tr>
<td align="center" style="padding:8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:440px;">
    You can follow every scan from your purchases page.
  </p>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()

/**
 * **Paste this in Klaviyo** — buyer delivered email.
 * Same metric, `status_code` equals `DE` branch.
 */
export const KLAVIYO_ORDER_DELIVERED_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    Your order has been delivered
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
    Hi {{ first_name|default:'there' }}, <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> has arrived. Stoked for you!
  </p>
</td>
</tr>

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Delivery details
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Item</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'Title' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Status</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'status_label' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Location</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'latest_event_location' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}color:${C.muted};width:42%;vertical-align:top;">Carrier</td>
            <td style="${summaryRowStyle}font-weight:600;">{{ event|lookup:'tracking_carrier' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${lastRowStyle}color:${C.muted};width:42%;vertical-align:top;">Tracking</td>
            <td style="${lastRowStyle}font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;word-break:break-all;">{{ event|lookup:'tracking_number' }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">View order</a>
</td>
</tr>

<tr>
<td align="center" style="padding:8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:480px;">
    Need to get in touch with the seller? You can reach them anytime through your order details or the messages tab.
  </p>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()
