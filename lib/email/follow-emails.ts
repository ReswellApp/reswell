/**
 * Email templates for the follow seller notification system.
 * Wire to Resend (or your transactional provider) to send.
 *
 * Daily digest: max ONE email per follower per day.
 * Batch all new follow notifications since last digest into a single email.
 */

export interface FollowDigestListing {
  title: string
  price: number
  thumbnailUrl?: string
  listingUrl: string
}

export interface FollowDigestSeller {
  sellerName: string
  sellerCity?: string
  shopUrl: string
  listings: FollowDigestListing[]
}

export interface FollowDigestEmailData {
  recipientName: string
  sellers: FollowDigestSeller[]
  browseAllUrl: string
  managePrefsUrl: string
}

export function buildFollowDigestEmail(data: FollowDigestEmailData): {
  subject: string
  text: string
  html: string
} {
  const { recipientName, sellers, browseAllUrl, managePrefsUrl } = data

  const subject = `New listings from sellers you follow on Reswell`

  const sellerBlocks = sellers
    .map((seller) => {
      const listingLines = seller.listings
        .map((l) => `  • ${l.title} — $${l.price.toFixed(2)}\n    ${l.listingUrl}`)
        .join('\n')
      const location = seller.sellerCity ? ` — ${seller.sellerCity}` : ''
      return `${seller.sellerName}${location}\n${listingLines}\nView ${seller.sellerName}'s shop: ${seller.shopUrl}`
    })
    .join('\n\n---\n\n')

  const text = `Hey ${recipientName},

Sellers you follow posted new gear today:

${sellerBlocks}

Browse all new listings: ${browseAllUrl}
Manage notification preferences: ${managePrefsUrl}

—
Reswell Marketplace
You're receiving this because you follow sellers on Reswell.
`

  const sellerHtml = sellers
    .map((seller) => {
      const location = seller.sellerCity ? ` &mdash; ${seller.sellerCity}` : ''
      const listingRows = seller.listings
        .map(
          (l) => `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
              ${
                l.thumbnailUrl
                  ? `<img src="${l.thumbnailUrl}" alt="" width="56" height="56"
                       style="object-fit:cover; border-radius:6px; vertical-align:middle; margin-right:12px;" />`
                  : ''
              }
              <a href="${l.listingUrl}" style="color:#0070f3; text-decoration:none; font-weight:500;">
                ${l.title}
              </a>
              <span style="color:#666; margin-left:8px;">$${l.price.toFixed(2)}</span>
            </td>
          </tr>`
        )
        .join('')

      return `
        <div style="margin-bottom: 28px;">
          <h3 style="margin:0 0 8px; font-size:16px; color:#111;">
            ${seller.sellerName}<span style="color:#888; font-weight:400;">${location}</span>
          </h3>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${listingRows}
          </table>
          <a href="${seller.shopUrl}"
             style="display:inline-block; margin-top:10px; font-size:13px; color:#0070f3;">
            View ${seller.sellerName}&rsquo;s shop &rarr;
          </a>
        </div>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fafafa; margin:0; padding:0;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; margin-top:24px; box-shadow:0 1px 4px rgba(0,0,0,.06);">
    <div style="background:#000; padding:20px 28px;">
      <span style="color:#fff; font-size:22px; font-weight:800; letter-spacing:-0.5px;">Reswell</span>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 20px; font-size:15px; color:#444;">
        Hey ${recipientName}, sellers you follow posted new gear today:
      </p>
      ${sellerHtml}
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
      <p style="margin:0 0 8px;">
        <a href="${browseAllUrl}" style="color:#0070f3; font-weight:600; text-decoration:none;">
          Browse all new listings &rarr;
        </a>
      </p>
      <p style="margin:0; font-size:12px; color:#999;">
        <a href="${managePrefsUrl}" style="color:#999;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`

  return { subject, text, html }
}

/** Single notification email for an immediate alert (not used in digest — for reference). */
export function buildNewListingAlertEmail(data: {
  recipientName: string
  sellerName: string
  sellerCity?: string
  listingTitle: string
  listingPrice: number
  listingUrl: string
  shopUrl: string
  managePrefsUrl: string
}): { subject: string; text: string } {
  const location = data.sellerCity ? ` in ${data.sellerCity}` : ''
  return {
    subject: `${data.sellerName} just listed new gear on Reswell`,
    text: `Hey ${data.recipientName},\n\n${data.sellerName}${location} just listed:\n\n${data.listingTitle} — $${data.listingPrice.toFixed(2)}\n${data.listingUrl}\n\nView shop: ${data.shopUrl}\n\nManage preferences: ${data.managePrefsUrl}`,
  }
}
