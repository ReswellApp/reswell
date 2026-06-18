import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { OrderReviewInviteView } from "@/components/features/reviews/order-review-invite-view"
import { loadOrderReviewInvitePageContext } from "@/lib/services/orderReviewInvite"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"

type PageProps = { params: Promise<{ token: string }> }

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { token } = await props.params
  return privatePageMetadata({
    title: "Leave a review — Reswell",
    description: "Rate your seller for a completed Reswell purchase.",
    path: `/review/${token}`,
  })
}

/**
 * Direct review link for buyers — token is stored on `order_review_invites` and sent via Klaviyo.
 */
export default async function OrderReviewInvitePage(props: PageProps) {
  const { token } = await props.params
  const trimmed = token?.trim()
  if (!trimmed) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const reviewPath = `/review/${encodeURIComponent(trimmed)}`
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(reviewPath)}`)
  }

  const context = await loadOrderReviewInvitePageContext(trimmed, user.id)
  if (!context) {
    notFound()
  }

  return <OrderReviewInviteView {...context} />
}
