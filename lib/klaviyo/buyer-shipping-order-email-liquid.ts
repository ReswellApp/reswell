/**
 * Copy-paste HTML for Klaviyo buyer **shipping** order confirmation emails.
 *
 * **Flow setup**
 * 1. Flows → Create flow → Metric → **Purchase Successful**
 * 2. Add filter: `fulfillment_method` equals `shipping`
 * 3. Email → drag **Code** / custom HTML → paste `KLAVIYO_BUYER_SHIPPING_ORDER_EMAIL_HTML`
 * 4. Preview with a recent **Purchase Successful** event (shipping) to verify variables
 *
 * **Event variables used** (from `track-buyer-order-confirmed.ts` / `track-placed-order.ts`):
 * - `order_num`, `Title`, `order_url`, `listing_url`, `fulfillment_method`
 * - `Items[]` — `ProductName`, `ImageURL`, `ProductURL`, `Quantity`, `ItemPrice`, `RowTotal`
 * - Product hero image: `{{ event.Items.0.ImageURL|default:'' }}` (single-item) or `{{ item.ImageURL|default:'' }}` (multi-item)
 * - `shipping_amount_display`, `promo_discount_display`, `promo_code`, `promo_label` — charge rows
 * - `$value` — order total; format with `{% currency_format event|lookup:'$value' %}`
 *
 * **Klaviyo audit checklist (blocks outside this HTML):**
 * - If you keep Klaviyo's logo block, remove the `<img>` logo row below to avoid duplication
 * - Footer unsubscribe / address blocks stay in Klaviyo's template shell
 *
 * **Liquid loops:** `{% for item in event.Items %}` works in Klaviyo flow HTML blocks.
 * If your workspace renders raw `{% for %}`, use `KLAVIYO_BUYER_SHIPPING_ORDER_EMAIL_SINGLE_ITEM_HTML` instead.
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

/** Pill CTA — matches existing Reswell order confirmation emails. */
const pillButtonStyle = `display:inline-block;padding:14px 48px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:50px;letter-spacing:-0.02em;mso-padding-alt:0;`

const imgStyle = `display:block;width:100%;max-width:400px;height:auto;margin:0 auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;`

const summaryRowStyle = `padding:12px 0;border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};font-family:${fontSans};font-size:15px;color:${C.foreground};`

const orderChargesSummaryRows = `{% if event.shipping_amount_display %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}font-weight:500;">Shipping</td>
            <td align="right" style="${summaryRowStyle}white-space:nowrap;font-weight:600;">{{ event.shipping_amount_display }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.promo_discount_display %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}font-weight:500;">{{ event.promo_label|default:'Promo discount' }}</td>
            <td align="right" style="${summaryRowStyle}white-space:nowrap;font-weight:600;">{{ event.promo_discount_display }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}`

/**
 * **Paste this in Klaviyo** — multi-item aware (loops `event.Items`).
 * Trigger: **Purchase Successful** with `fulfillment_method = shipping`.
 */
export const KLAVIYO_BUYER_SHIPPING_ORDER_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    Your order is confirmed #{{ event|lookup:'order_num' }}
  </h1>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};line-height:1.5;color:${C.foreground};text-align:center;">
    Hi there, your purchase for <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> is confirmed. Stoked for you!
  </p>
</td>
</tr>

{% for item in event.Items %}
<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;">
    <tr>
      <td align="center" style="padding:0 0 16px 0;">
        <a href="{{ item.ProductURL }}" style="text-decoration:none;">
          <img src="{{ item.ImageURL|default:'' }}" alt="{{ item.ProductName }}" width="400" style="${imgStyle}" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family:${fontSans};text-align:center;">
        <a href="{{ item.ProductURL }}" style="font-family:${fontHeadline};font-size:18px;font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;line-height:1.3;">{{ item.ProductName }}</a>
        {% if item.Quantity > 1 %}
        <p style="margin:6px 0 0 0;font-family:${fontSans};font-size:14px;color:${C.muted};">Qty {{ item.Quantity }}</p>
        {% endif %}
        <p style="margin:8px 0 0 0;font-family:${fontHeadline};font-size:17px;font-weight:600;color:${C.price};">{% currency_format item.RowTotal %}</p>
      </td>
    </tr>
  </table>
</td>
</tr>
{% endfor %}

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Order summary
      </td>
    </tr>
    {% for item in event.Items %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}">
              <span style="font-weight:500;">{{ item.ProductName }}</span>
              {% if item.Quantity > 1 %}<span style="color:${C.muted};"> &times; {{ item.Quantity }}</span>{% endif %}
            </td>
            <td align="right" style="${summaryRowStyle}white-space:nowrap;font-weight:600;">
              {% currency_format item.RowTotal %}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    {% endfor %}
    ${orderChargesSummaryRows}
    <tr>
      <td style="padding:12px 20px 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.foreground};">Total</td>
            <td align="right" style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.price};">{% currency_format event|lookup:'$value' %}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:440px;">
    Your seller is preparing your order for shipment. We&rsquo;ll email you tracking details once it&rsquo;s on the way.
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0 0 16px 0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};color:${C.foreground};text-align:center;">
    You can find your order details here:
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">Orders</a>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 32px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'listing_url' }}" style="${pillButtonStyle}">View Listing</a>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:480px;">
    Need to get in touch with the seller? You can reach them anytime through your order details or the messages tab.
  </p>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()

/**
 * Single-item fallback when `{% for %}` renders as visible text in your Klaviyo workspace.
 * Uses `event.Items.0` only — sufficient for typical one-listing checkouts.
 */
export const KLAVIYO_BUYER_SHIPPING_ORDER_EMAIL_SINGLE_ITEM_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
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
    Your order is confirmed #{{ event|lookup:'order_num' }}
  </h1>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};line-height:1.5;color:${C.foreground};text-align:center;">
    Hi there, your purchase for <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> is confirmed. Stoked for you!
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;">
    <tr>
      <td align="center" style="padding:0 0 16px 0;">
        <a href="{{ event|lookup:'listing_url' }}" style="text-decoration:none;">
          <img src="{{ event.Items.0.ImageURL|default:'' }}" alt="{{ event|lookup:'Title' }}" width="400" style="${imgStyle}" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="font-family:${fontSans};text-align:center;">
        <a href="{{ event|lookup:'listing_url' }}" style="font-family:${fontHeadline};font-size:18px;font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;line-height:1.3;">{{ event|lookup:'Title' }}</a>
        <p style="margin:8px 0 0 0;font-family:${fontHeadline};font-size:17px;font-weight:600;color:${C.price};">{% currency_format event.Items.0.RowTotal %}</p>
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
        Order summary
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${summaryRowStyle}font-weight:500;">{{ event|lookup:'Title' }}</td>
            <td align="right" style="${summaryRowStyle}white-space:nowrap;font-weight:600;">{% currency_format event.Items.0.RowTotal %}</td>
          </tr>
        </table>
      </td>
    </tr>
    ${orderChargesSummaryRows}
    <tr>
      <td style="padding:12px 20px 16px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.foreground};">Total</td>
            <td align="right" style="font-family:${fontHeadline};font-size:16px;font-weight:700;color:${C.price};">{% currency_format event|lookup:'$value' %}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:440px;">
    Your seller is preparing your order for shipment. We&rsquo;ll email you tracking details once it&rsquo;s on the way.
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0 0 16px 0;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BODY_FONT_SIZE};color:${C.foreground};text-align:center;">
    You can find your order details here:
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">Orders</a>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 32px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'listing_url' }}" style="${pillButtonStyle}">View Listing</a>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:480px;">
    Need to get in touch with the seller? You can reach them anytime through your order details or the messages tab.
  </p>
</td>
</tr>

</table>
</td>
</tr>
</table>`.trim()
