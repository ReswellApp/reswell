/**
 * One Klaviyo HTML template for the marketplace nudge metrics.
 *
 * Paste into each flow’s email (Code / custom HTML):
 * - Offer Declined
 * - Counteroffer Declined
 * - Offer Expiring
 * - Seller Ship Reminder
 * - Pickup Reminder
 *
 * Subject and preview stay in the Klaviyo flow. Body copy is on the event
 * (`headline`, `body_line`, `cta_label`) so one template covers every metric.
 *
 * Suggested subjects:
 * - Offer Declined — Your offer was declined
 * - Counteroffer Declined — Your counteroffer was declined
 * - Offer Expiring — This offer expires soon
 * - Seller Ship Reminder — Ship {{ event|lookup:'Title' }}
 * - Pickup Reminder — Your pickup is waiting
 *
 * Event fields from `track-marketplace-nudge.ts`:
 * headline, body_line, Title, price_display, photo_url, cta_label, cta_url,
 * listing_url, secondary_label, secondary_url
 *
 * UTMs are already on cta_url and secondary_url. Do not append another query.
 * No {% if %} / {% for %} — those often print as raw text.
 * If the Klaviyo shell already has a logo or footer, delete the logo row.
 */

export const KLAVIYO_MARKETPLACE_NUDGE_EMAIL_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#FFFFFF;">
  <tr>
    <td align="center" style="padding:32px 16px 40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;max-width:600px;">
        <tr>
          <td align="center" style="padding:0 0 28px 0;">
            <a href="https://www.reswell.app?utm_source=klaviyo&utm_medium=email&utm_campaign=marketplace_nudge&utm_content=logo" style="text-decoration:none;">
              <img src="https://www.reswell.app/images/reswell-logo.png" alt="Reswell" width="160" height="40" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 8px 32px;">
            <h1 style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:28px;font-weight:700;color:#04070E;letter-spacing:-0.03em;line-height:1.2;text-align:center;">
              {{ event|lookup:'headline' }}
            </h1>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 24px 32px;">
            <p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:1.5;color:#04070E;text-align:center;">
              Hey {{ first_name|default:'there' }} &mdash; {{ event|lookup:'body_line' }}
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 16px 32px;">
            <a href="{{ event|lookup:'listing_url' }}" style="text-decoration:none;">
              <img src="{{ event|lookup:'photo_url' }}" alt="{{ event|lookup:'Title' }}" width="400" style="display:block;width:100%;max-width:400px;height:auto;margin:0 auto;border-radius:8px;border:1px solid #E2E8F0;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 24px 32px;">
            <a href="{{ event|lookup:'listing_url' }}" style="font-family:Arial, Helvetica, sans-serif;font-size:18px;font-weight:600;color:#04070E;text-decoration:none;letter-spacing:-0.02em;line-height:1.3;">{{ event|lookup:'Title' }}</a>
            <p style="margin:8px 0 0 0;font-family:Arial, Helvetica, sans-serif;font-size:17px;font-weight:600;color:#163060;">{{ event|lookup:'price_display' }}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 12px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td align="center" bgcolor="#5574AD" style="border-radius:50px;">
                  <a href="{{ event|lookup:'cta_url' }}" style="display:inline-block;padding:14px 48px;font-family:Arial, Helvetica, sans-serif;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:-0.02em;">
                    {{ event|lookup:'cta_label' }}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 0 32px;">
            <p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:1.5;color:#64748B;text-align:center;">
              <a href="{{ event|lookup:'secondary_url' }}" style="color:#5574AD;text-decoration:underline;">{{ event|lookup:'secondary_label' }}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`
