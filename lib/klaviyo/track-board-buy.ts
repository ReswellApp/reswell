import { boardBuyQuotePath } from "@/lib/board-buy/quote-href"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

async function sellerProfile(userId: string): Promise<{ email: string | null }> {
  return { email: await getAuthEmailForUserId(userId) }
}

function money(n: number | null): string {
  if (n == null) return ""
  return `$${n.toFixed(2)}`
}

export async function trackBoardBuySubmitted(submission: BoardBuySubmission): Promise<void> {
  const { email } = await sellerProfile(submission.userId)
  const origin = publicSiteOriginForEmail()
  await sendKlaviyoServerEvent({
    metricName: "Board Buy Submitted",
    profile: { external_id: submission.userId, email },
    properties: {
      Title: submission.title,
      asking_price_display: money(submission.askingPrice),
      submission_url: `${origin}${boardBuyQuotePath(submission.id)}`,
      admin_url: `${origin}/admin/we-buy/${submission.id}`,
    },
  })
}

export async function trackBoardBuyQuoteReady(submission: BoardBuySubmission): Promise<void> {
  const { email } = await sellerProfile(submission.userId)
  const origin = publicSiteOriginForEmail()
  await sendKlaviyoServerEvent({
    metricName: "Board Buy Quote Ready",
    profile: { external_id: submission.userId, email },
    properties: {
      Title: submission.title,
      asking_price_display: money(submission.askingPrice),
      offered_price_display: money(submission.offeredPrice),
      quote_source: submission.quoteSource ?? "",
      submission_url: `${origin}${boardBuyQuotePath(submission.id)}`,
    },
  })
}

export async function trackBoardBuyPaid(submission: BoardBuySubmission): Promise<void> {
  const { email } = await sellerProfile(submission.userId)
  const origin = publicSiteOriginForEmail()
  await sendKlaviyoServerEvent({
    metricName: "Board Buy Paid",
    profile: { external_id: submission.userId, email },
    properties: {
      Title: submission.title,
      paid_amount_display: money(submission.offeredPrice),
      wallet_url: `${origin}/dashboard/wallet`,
    },
  })
}
