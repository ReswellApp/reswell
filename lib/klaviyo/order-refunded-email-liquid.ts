/**
 * Copy-paste HTML for Klaviyo **Order Refunded** emails (buyer + seller).
 *
 * **Flow setup (one metric, both parties)**
 * 1. Flows → Create flow → Metric → **Order Refunded**
 * 2. Add two email actions (or a conditional split):
 *    - Buyer: filter `recipient_role` equals `buyer` → paste `KLAVIYO_ORDER_REFUNDED_BUYER_EMAIL_HTML`
 *    - Seller: filter `recipient_role` equals `seller` → paste `KLAVIYO_ORDER_REFUNDED_SELLER_EMAIL_HTML`
 * 3. Preview with a recent **Order Refunded** event for each role
 *
 * **Event variables** (from `track-order-refunded.ts`):
 * - `recipient_role` — `buyer` | `seller` (required for flow filters)
 * - `order_num`, `Title`, `amount_display`, `seller_earnings_display`
 * - `listing_image_url`, `listing_url`, `listing_brand`, `listing_board_type`,
 *   `listing_condition`, `listing_section_label`, `listing_location`, `listing_dimensions`
 * - `Items[]` — `ProductName`, `ImageURL`, `ProductURL`, `Quantity`, `RowTotal`,
 *   `Brand`, `BoardType`, `Condition`, `Location`, `Dimensions`, `SectionLabel`
 * - `payment_method_label`, `fulfillment_method_label`, `refund_destination`
 * - `buyer_display_name`, `seller_display_name`, `order_url`, `dashboard_cta_label`
 */

import {
  KLAVIYO_EMAIL_BORDER,
  KLAVIYO_EMAIL_BODY_FONT_SIZE,
  KLAVIYO_EMAIL_BUTTON_FONT_SIZE,
  KLAVIYO_EMAIL_COLORS,
  KLAVIYO_EMAIL_FONT_HEADLINE,
  KLAVIYO_EMAIL_FONT_SANS,
  KLAVIYO_EMAIL_HORIZONTAL_PADDING,
  KLAVIYO_EMAIL_MUTED,
  KLAVIYO_EMAIL_RADIUS,
} from "@/lib/klaviyo/email-brand-styles"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

const C = KLAVIYO_EMAIL_COLORS
const fontSans = KLAVIYO_EMAIL_FONT_SANS
const fontHeadline = KLAVIYO_EMAIL_FONT_HEADLINE
const siteOrigin = publicSiteOriginForEmail()
const logoUrl = `${siteOrigin}/images/reswell-logo.png`

const pillButtonStyle = `display:inline-block;padding:14px 48px;font-family:${fontSans};font-size:${KLAVIYO_EMAIL_BUTTON_FONT_SIZE};font-weight:600;color:${C.buttonText};text-decoration:none;background:${C.buttonBg};border-radius:50px;letter-spacing:-0.02em;mso-padding-alt:0;`

const imgStyle = `display:block;width:100%;max-width:400px;height:auto;margin:0 auto;border-radius:${KLAVIYO_EMAIL_RADIUS};border:1px solid ${KLAVIYO_EMAIL_BORDER};object-fit:cover;`

const metaRowStyle = `padding:8px 0;border-bottom:1px solid ${KLAVIYO_EMAIL_BORDER};font-family:${fontSans};font-size:14px;color:${C.foreground};`

const listingMetaBlock = `
{% if event.listing_brand or event.listing_board_type or event.listing_condition or event.listing_section_label or event.listing_dimensions or event.listing_location %}
<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:14px 20px 6px 20px;font-family:${fontHeadline};font-size:12px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Listing details
      </td>
    </tr>
    {% if event.listing_section_label %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}color:${KLAVIYO_EMAIL_MUTED};width:40%;">Category</td>
            <td style="${metaRowStyle}font-weight:600;">{{ event|lookup:'listing_section_label' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.listing_brand %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}color:${KLAVIYO_EMAIL_MUTED};width:40%;">Brand</td>
            <td style="${metaRowStyle}font-weight:600;">{{ event|lookup:'listing_brand' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.listing_board_type %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}color:${KLAVIYO_EMAIL_MUTED};width:40%;">Type</td>
            <td style="${metaRowStyle}font-weight:600;">{{ event|lookup:'listing_board_type' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.listing_condition %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}color:${KLAVIYO_EMAIL_MUTED};width:40%;">Condition</td>
            <td style="${metaRowStyle}font-weight:600;">{{ event|lookup:'listing_condition' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.listing_dimensions %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}color:${KLAVIYO_EMAIL_MUTED};width:40%;">Dimensions</td>
            <td style="${metaRowStyle}font-weight:600;">{{ event|lookup:'listing_dimensions' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.listing_location %}
    <tr>
      <td style="padding:0 20px 8px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}border-bottom:0;color:${KLAVIYO_EMAIL_MUTED};width:40%;">Location</td>
            <td style="${metaRowStyle}border-bottom:0;font-weight:600;">{{ event|lookup:'listing_location' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
  </table>
</td>
</tr>
{% endif %}
`

const itemsBlock = `
{% for item in event.Items %}
<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 20px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;">
    {% if item.ImageURL %}
    <tr>
      <td align="center" style="padding:0 0 16px 0;">
        <a href="{{ item.ProductURL }}" style="text-decoration:none;">
          <img src="{{ item.ImageURL }}" alt="{{ item.ProductName }}" width="400" style="${imgStyle}" />
        </a>
      </td>
    </tr>
    {% endif %}
    <tr>
      <td align="center" style="font-family:${fontSans};text-align:center;">
        <a href="{{ item.ProductURL }}" style="font-family:${fontHeadline};font-size:18px;font-weight:600;color:${C.foreground};text-decoration:none;letter-spacing:-0.02em;line-height:1.3;">{{ item.ProductName }}</a>
        {% if item.Brand or item.BoardType or item.Condition %}
        <p style="margin:8px 0 0 0;font-family:${fontSans};font-size:14px;line-height:1.45;color:${C.muted};">
          {% if item.Brand %}{{ item.Brand }}{% endif %}{% if item.Brand and item.BoardType %} · {% endif %}{% if item.BoardType %}{{ item.BoardType }}{% endif %}{% if item.Condition %}{% if item.Brand or item.BoardType %} · {% endif %}{{ item.Condition }}{% endif %}
        </p>
        {% endif %}
        {% if item.Dimensions %}
        <p style="margin:4px 0 0 0;font-family:${fontSans};font-size:14px;color:${C.muted};">{{ item.Dimensions }}</p>
        {% endif %}
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
`

const logoBlock = `
<tr>
<td align="center" style="padding:0 0 28px 0;">
  <a href="${siteOrigin}" style="text-decoration:none;">
    <img src="${logoUrl}" alt="Reswell" width="160" height="40" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
  </a>
</td>
</tr>
`

/**
 * **Paste this in Klaviyo** — buyer refund confirmation.
 * Trigger: **Order Refunded** with filter `recipient_role` equals `buyer`.
 */
export const KLAVIYO_ORDER_REFUNDED_BUYER_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
<tr>
<td align="center" style="padding:32px 16px 40px 16px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:600px;">
${logoBlock}

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <h1 style="margin:0;font-family:${fontHeadline};font-size:28px;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;line-height:1.2;text-align:center;">
    Your refund is on the way
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
    Hi{% if event.buyer_display_name %} {{ event|lookup:'buyer_display_name' }}{% endif %}, we&rsquo;ve fully refunded your purchase of <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong>. {{ event|lookup:'amount_display' }} is returning to {{ event|lookup:'refund_destination' }}.
  </p>
</td>
</tr>

${itemsBlock}
${listingMetaBlock}

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:440px;margin:0 auto;border:1px solid ${KLAVIYO_EMAIL_BORDER};border-radius:${KLAVIYO_EMAIL_RADIUS};overflow:hidden;">
    <tr>
      <td style="padding:16px 20px 8px 20px;font-family:${fontHeadline};font-size:13px;font-weight:700;color:${C.foreground};letter-spacing:0.06em;text-transform:uppercase;">
        Refund summary
      </td>
    </tr>
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}">Refund amount</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:700;color:${C.price};">{{ event|lookup:'amount_display' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% if event.payment_method_label %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}">Paid with</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:600;">{{ event|lookup:'payment_method_label' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.fulfillment_method_label %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}">Fulfillment</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:600;">{{ event|lookup:'fulfillment_method_label' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.seller_display_name %}
    <tr>
      <td style="padding:0 20px 8px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}border-bottom:0;">Seller</td>
            <td align="right" style="${metaRowStyle}border-bottom:0;white-space:nowrap;font-weight:600;">{{ event|lookup:'seller_display_name' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:440px;">
    Card refunds can take a few business days to appear on your statement. Wallet refunds show up right away in your Reswell balance.
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">{{ event|lookup:'dashboard_cta_label'|default:'View purchase' }}</a>
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

/**
 * **Paste this in Klaviyo** — seller refund notice.
 * Trigger: **Order Refunded** with filter `recipient_role` equals `seller`.
 */
export const KLAVIYO_ORDER_REFUNDED_SELLER_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${C.background};">
<tr>
<td align="center" style="padding:32px 16px 40px 16px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:600px;">
${logoBlock}

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 8px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <h1 style="margin:0;font-family:${fontHeadline};font-size:28px;font-weight:700;color:${C.foreground};letter-spacing:-0.03em;line-height:1.2;text-align:center;">
    Order refunded
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
    Hi{% if event.seller_display_name %} {{ event|lookup:'seller_display_name' }}{% endif %}, the sale of <strong style="font-weight:600;">{{ event|lookup:'Title' }}</strong> to {% if event.buyer_display_name %}{{ event|lookup:'buyer_display_name' }}{% else %}the buyer{% endif %} has been fully refunded. Your listing is back on Reswell, and any earnings from this sale have been reversed.
  </p>
</td>
</tr>

${itemsBlock}
${listingMetaBlock}

<tr>
<td style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 24px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
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
            <td style="${metaRowStyle}">Order total</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:700;color:${C.price};">{{ event|lookup:'amount_display' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% if event.seller_earnings_display %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}">Earnings reversed</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:600;">{{ event|lookup:'seller_earnings_display' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.fulfillment_method_label %}
    <tr>
      <td style="padding:0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}">Fulfillment</td>
            <td align="right" style="${metaRowStyle}white-space:nowrap;font-weight:600;">{{ event|lookup:'fulfillment_method_label' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
    {% if event.buyer_display_name %}
    <tr>
      <td style="padding:0 20px 8px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="${metaRowStyle}border-bottom:0;">Buyer</td>
            <td align="right" style="${metaRowStyle}border-bottom:0;white-space:nowrap;font-weight:600;">{{ event|lookup:'buyer_display_name' }}</td>
          </tr>
        </table>
      </td>
    </tr>
    {% endif %}
  </table>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 28px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <p style="margin:0;font-family:${fontSans};font-size:15px;line-height:1.5;color:${C.muted};text-align:center;max-width:440px;">
    Your listing is live again on Reswell. If you have questions about this refund, reply through Messages or contact support.
  </p>
</td>
</tr>

<tr>
<td align="center" style="padding:0 ${KLAVIYO_EMAIL_HORIZONTAL_PADDING} 12px ${KLAVIYO_EMAIL_HORIZONTAL_PADDING};">
  <a href="{{ event|lookup:'order_url' }}" style="${pillButtonStyle}">{{ event|lookup:'dashboard_cta_label'|default:'View sale' }}</a>
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
